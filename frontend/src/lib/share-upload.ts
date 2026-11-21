import { isAxiosError, isCancel } from 'axios'
import { retryAfterSeconds } from '#lib/api-errors'
import { hashFile } from '#lib/file-hash'
import { DifferentFileError, UploadCanceledError } from '#lib/share-errors'
import type { UploadHandle, UploadTarget } from '#lib/upload-target'
import { missingParts, partSizeOf, splitIntoParts, type FilePart } from '#utils/file-parts'
import { forgetUpload, isSameFile, recallUpload, rememberUpload } from '#utils/pending-uploads'

export const PART_CONCURRENCY = 3
export const PART_MAX_ATTEMPTS = 5
export const PART_RETRY_BASE_DELAY_MS = 1000

const REQUEST_TIMEOUT = 408
const TOO_MANY_REQUESTS = 429
const FIRST_SERVER_ERROR = 500
const MS_PER_SECOND = 1000

export type TransferPhase = 'hashing' | 'uploading' | 'completing'

export interface UploadObserver {
  onPhase: (phase: TransferPhase) => void
  onHashed: (hashedBytes: number) => void
  onSent: (sentBytes: number) => void
  onPartSize: (partSize: number) => void
  onTokenIssued: (uploadToken: string) => void
  onOpened: (fileId: string) => void
}

export interface UploadRequest {
  shareId: string
  target: UploadTarget
  file: File
  signal: AbortSignal
  observer: UploadObserver
}

export interface ResumeRequest extends UploadRequest {
  fileId: string
  uploadToken?: string
}

interface PartsTransfer extends ResumeRequest {
  parts: FilePart[]
  alreadySent: number
}

function throwIfCanceled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new UploadCanceledError()
  }
}

function isRetryable(error: unknown): boolean {
  if (!isAxiosError(error) || isCancel(error)) {
    return false
  }
  const status = error.response?.status
  return (
    status === undefined || status === REQUEST_TIMEOUT || status === TOO_MANY_REQUESTS || status >= FIRST_SERVER_ERROR
  )
}

function retryDelayMs(error: unknown, attempt: number): number {
  const retryAfter = retryAfterSeconds(error)
  return retryAfter === null ? PART_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) : retryAfter * MS_PER_SECOND
}

function waitBeforeRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, delayMs)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

function handleOf({ fileId, uploadToken }: ResumeRequest): UploadHandle {
  return { fileId, uploadToken }
}

function untilCanceled<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new UploadCanceledError())
    signal.addEventListener('abort', cancel, { once: true })
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', cancel))
  })
}

async function proofBeforeAnnounce(target: UploadTarget, signal: AbortSignal): Promise<string | undefined> {
  if (!target.beforeAnnounce) {
    return undefined
  }
  const proof = await untilCanceled(target.beforeAnnounce(signal), signal)
  throwIfCanceled(signal)
  return proof
}

async function sendPart(
  transfer: PartsTransfer,
  part: FilePart,
  signal: AbortSignal,
  onProgress: (loadedBytes: number) => void,
): Promise<void> {
  const { target, file } = transfer
  const body = file.slice(part.start, part.end)
  for (let attempt = 1; ; attempt += 1) {
    throwIfCanceled(signal)
    try {
      await target.sendPart(handleOf(transfer), part.partNumber, body, { signal, onProgress })
      return
    } catch (error) {
      if (signal.aborted || attempt >= PART_MAX_ATTEMPTS || !isRetryable(error)) {
        throw error
      }
      onProgress(0)
      await waitBeforeRetry(retryDelayMs(error, attempt), signal)
    }
  }
}

async function sendParts(transfer: PartsTransfer): Promise<void> {
  const { parts, alreadySent, observer, signal } = transfer
  const firstFailure = new AbortController()
  const partSignal = AbortSignal.any([signal, firstFailure.signal])
  const pending = [...parts]
  const inFlight = new Map<number, number>()
  let sent = alreadySent

  function report() {
    observer.onSent(sent + [...inFlight.values()].reduce((total, loaded) => total + loaded, 0))
  }

  async function sendPendingParts() {
    for (let part = pending.shift(); part && !partSignal.aborted; part = pending.shift()) {
      const { partNumber } = part
      await sendPart(transfer, part, partSignal, (loaded) => {
        inFlight.set(partNumber, loaded)
        report()
      })
      inFlight.delete(partNumber)
      sent += partSizeOf(part)
      report()
    }
  }

  report()
  try {
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, parts.length) }, sendPendingParts))
  } catch (error) {
    firstFailure.abort()
    throw error
  }
}

async function transferAndComplete(transfer: PartsTransfer): Promise<void> {
  const { target, signal, observer } = transfer
  observer.onPhase('uploading')
  await sendParts(transfer)
  throwIfCanceled(signal)
  observer.onPhase('completing')
  await target.complete(handleOf(transfer))
  forgetUpload(transfer.fileId)
}

function remember({ shareId, fileId, uploadToken, file }: ResumeRequest, sha256: string): void {
  rememberUpload({
    shareId,
    fileId,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    sha256,
    uploadToken,
  })
}

function canceledOr(error: unknown, signal: AbortSignal): unknown {
  return signal.aborted ? new UploadCanceledError() : error
}

export async function uploadNewFile(request: UploadRequest): Promise<void> {
  const { target, file, signal, observer } = request
  try {
    observer.onPhase('hashing')
    const sha256 = await hashFile(file, observer.onHashed, signal)
    throwIfCanceled(signal)
    const proof = await proofBeforeAnnounce(target, signal)
    const { fileId, partSize, uploadToken } = await target.announce(
      { name: file.name, size: file.size, sha256 },
      proof,
    )
    remember({ ...request, fileId, uploadToken }, sha256)
    if (uploadToken) {
      observer.onTokenIssued(uploadToken)
    }
    observer.onOpened(fileId)
    observer.onPartSize(partSize)
    throwIfCanceled(signal)
    await transferAndComplete({
      ...request,
      fileId,
      uploadToken,
      parts: splitIntoParts(file.size, partSize),
      alreadySent: 0,
    })
  } catch (error) {
    throw canceledOr(error, signal)
  }
}

async function checkSameFile(request: ResumeRequest, size: number, sha256: string): Promise<void> {
  const { fileId, file, signal, observer } = request
  const remembered = recallUpload(fileId)
  if (remembered) {
    if (!isSameFile(remembered, file)) {
      throw new DifferentFileError()
    }
    return
  }
  if (file.size !== size) {
    throw new DifferentFileError()
  }
  observer.onPhase('hashing')
  if ((await hashFile(file, observer.onHashed, signal)) !== sha256) {
    throw new DifferentFileError()
  }
  remember(request, sha256)
}

export async function resumeFile(request: ResumeRequest): Promise<void> {
  const { target, signal, observer } = request
  try {
    const { size, sha256, partSize, parts: received } = await target.listParts(handleOf(request))
    observer.onPartSize(partSize)
    await checkSameFile(request, size, sha256)
    throwIfCanceled(signal)
    const parts = missingParts(size, partSize, received)
    const alreadySent = size - parts.reduce((total, part) => total + partSizeOf(part), 0)
    await transferAndComplete({ ...request, parts, alreadySent })
  } catch (error) {
    throw canceledOr(error, signal)
  }
}
