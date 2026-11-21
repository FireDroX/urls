import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeFileUpload,
  listFileParts,
  startFileUpload,
  uploadFilePart,
  type PartTransfer,
  type UploadParts,
  type UploadStarted,
} from '#api/shares'
import { hashFile } from '#lib/file-hash'
import { shareUploadTarget } from '#lib/share-upload-target'
import type { UploadTarget } from '#lib/upload-target'
import { DifferentFileError, UploadCanceledError } from '#lib/share-errors'
import { recallUpload, rememberUpload } from '#utils/pending-uploads'
import { PART_CONCURRENCY, PART_MAX_ATTEMPTS, resumeFile, uploadNewFile, type UploadObserver } from './share-upload'

vi.mock('#api/shares', () => ({
  startFileUpload: vi.fn(),
  uploadFilePart: vi.fn(),
  completeFileUpload: vi.fn(),
  listFileParts: vi.fn(),
}))

vi.mock('#lib/file-hash', () => ({ hashFile: vi.fn() }))

const SHARE_ID = 'photos'
const FILE_ID = 'file1234'
const SHA256 = 'ab'.repeat(32)
const PART_SIZE = 10
const CONTENT = 'x'.repeat(25)

const started = { fileId: FILE_ID, partSize: PART_SIZE, partCount: 3 } as UploadStarted

function file(content = CONTENT, name = 'video.mp4', lastModified = 1000): File {
  return new File([content], name, { lastModified })
}

function observer(): UploadObserver {
  return { onPhase: vi.fn(), onHashed: vi.fn(), onSent: vi.fn(), onPartSize: vi.fn(), onTokenIssued: vi.fn(), onOpened: vi.fn() }
}

function httpError(status: number, headers: Record<string, string> = {}): AxiosError {
  const response = {
    status,
    data: { error: 'failed' },
    headers: new AxiosHeaders(headers),
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

function networkError(): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK)
}

function sentPartNumbers(): number[] {
  return vi.mocked(uploadFilePart).mock.calls.map(([, , partNumber]) => partNumber)
}

function remoteParts(parts: UploadParts['parts'], size = CONTENT.length): UploadParts {
  return { fileId: FILE_ID, size, sha256: SHA256, partSize: PART_SIZE, partCount: 3, parts }
}

function rememberCurrentFile() {
  rememberUpload({ shareId: SHARE_ID, fileId: FILE_ID, name: 'video.mp4', size: 25, lastModified: 1000, sha256: SHA256 })
}

function request(selected = file(), signal = new AbortController().signal) {
  return { shareId: SHARE_ID, target: shareUploadTarget(SHARE_ID), file: selected, signal, observer: observer() }
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(hashFile).mockResolvedValue(SHA256)
  vi.mocked(startFileUpload).mockResolvedValue(started)
  vi.mocked(uploadFilePart).mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('uploadNewFile', () => {
  it('hashes, announces, sends every part with its exact slice, then completes', async () => {
    const selected = file()
    await uploadNewFile(request(selected))

    expect(startFileUpload).toHaveBeenCalledWith(SHARE_ID, { name: 'video.mp4', size: 25, sha256: SHA256 })
    const sizes = vi.mocked(uploadFilePart).mock.calls.map(([, , partNumber, body]) => [partNumber, body.size])
    expect(sizes).toEqual([
      [1, 10],
      [2, 10],
      [3, 5],
    ])
    expect(completeFileUpload).toHaveBeenCalledWith(SHARE_ID, FILE_ID)
  })

  it('remembers the upload while it runs and forgets it once complete', async () => {
    let remembered: unknown
    vi.mocked(uploadFilePart).mockImplementation(() => {
      remembered = recallUpload(FILE_ID)
      return Promise.resolve()
    })

    await uploadNewFile(request())

    expect(remembered).toEqual({
      shareId: SHARE_ID,
      fileId: FILE_ID,
      name: 'video.mp4',
      size: 25,
      lastModified: 1000,
      sha256: SHA256,
      savedAt: expect.any(Number),
    })
    expect(recallUpload(FILE_ID)).toBeUndefined()
  })

  it('never sends more parts at once than the concurrency limit', async () => {
    vi.mocked(startFileUpload).mockResolvedValue({ ...started, partSize: 1 })
    let running = 0
    let peak = 0
    vi.mocked(uploadFilePart).mockImplementation(async () => {
      running += 1
      peak = Math.max(peak, running)
      await Promise.resolve()
      running -= 1
    })

    await uploadNewFile(request())

    expect(uploadFilePart).toHaveBeenCalledTimes(25)
    expect(peak).toBe(PART_CONCURRENCY)
  })

  it('adds up the progress of the parts in flight and the finished ones', async () => {
    const reports: number[] = []
    vi.mocked(uploadFilePart).mockImplementation(
      (_share, _file, _part, body, { onProgress }: PartTransfer) => {
        onProgress(body.size)
        return Promise.resolve()
      },
    )
    const upload = request()
    vi.mocked(upload.observer.onSent).mockImplementation((sent) => void reports.push(sent))

    await uploadNewFile(upload)

    expect(reports.at(-1)).toBe(25)
    expect(Math.max(...reports)).toBe(25)
  })

  it('retries only the failed part after a network error', async () => {
    vi.useFakeTimers()
    vi.mocked(uploadFilePart).mockImplementation((_share, _file, partNumber) => {
      const firstTry = sentPartNumbers().filter((number) => number === 2).length === 1
      return partNumber === 2 && firstTry ? Promise.reject(networkError()) : Promise.resolve()
    })

    const upload = uploadNewFile(request())
    await vi.runAllTimersAsync()
    await upload

    expect(sentPartNumbers().sort()).toEqual([1, 2, 2, 3])
    expect(completeFileUpload).toHaveBeenCalledOnce()
  })

  it('waits for Retry-After on a 429 before sending the part again', async () => {
    vi.useFakeTimers()
    vi.mocked(uploadFilePart).mockRejectedValueOnce(httpError(429, { 'retry-after': '30' }))

    const upload = uploadNewFile(request())
    await vi.advanceTimersByTimeAsync(29_000)
    expect(completeFileUpload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    await upload

    expect(completeFileUpload).toHaveBeenCalledOnce()
  })

  it('gives up after a bounded number of attempts and keeps the upload resumable', async () => {
    vi.useFakeTimers()
    vi.mocked(startFileUpload).mockResolvedValue({ ...started, partSize: 25 })
    vi.mocked(uploadFilePart).mockRejectedValue(httpError(503))

    const upload = expect(uploadNewFile(request())).rejects.toMatchObject({ response: { status: 503 } })
    await vi.runAllTimersAsync()
    await upload

    expect(uploadFilePart).toHaveBeenCalledTimes(PART_MAX_ATTEMPTS)
    expect(completeFileUpload).not.toHaveBeenCalled()
    expect(recallUpload(FILE_ID)).toBeDefined()
  })

  it.each([400, 404, 409, 413])('does not retry a part refused with %i', async (status) => {
    vi.mocked(startFileUpload).mockResolvedValue({ ...started, partSize: 25 })
    vi.mocked(uploadFilePart).mockRejectedValue(httpError(status))

    await expect(uploadNewFile(request())).rejects.toMatchObject({ response: { status } })

    expect(uploadFilePart).toHaveBeenCalledOnce()
  })

  it('stops the other parts as soon as one fails for good', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(uploadFilePart).mockImplementation((_share, _file, partNumber, _body, { signal }) => {
      signals.push(signal)
      if (partNumber === 1) return Promise.reject(httpError(409))
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new AxiosError('canceled', AxiosError.ERR_CANCELED)))
      })
    })

    await expect(uploadNewFile(request())).rejects.toMatchObject({ response: { status: 409 } })

    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it('cancels the parts in flight and does not complete', async () => {
    const controller = new AbortController()
    vi.mocked(uploadFilePart).mockImplementation((_share, _file, _part, _body, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new AxiosError('canceled', AxiosError.ERR_CANCELED)))
      })
    })

    const upload = uploadNewFile(request(file(), controller.signal))
    await vi.waitFor(() => expect(uploadFilePart).toHaveBeenCalled())
    controller.abort()

    await expect(upload).rejects.toBeInstanceOf(UploadCanceledError)
    expect(completeFileUpload).not.toHaveBeenCalled()
  })

  it('reports the file id even when canceled right after it was opened', async () => {
    const controller = new AbortController()
    const upload = request(file(), controller.signal)
    vi.mocked(startFileUpload).mockImplementation(() => {
      controller.abort()
      return Promise.resolve(started)
    })

    await expect(uploadNewFile(upload)).rejects.toBeInstanceOf(UploadCanceledError)

    expect(upload.observer.onOpened).toHaveBeenCalledWith(FILE_ID)
    expect(uploadFilePart).not.toHaveBeenCalled()
  })
})

describe('resumeFile', () => {
  const resumeRequest = (selected = file()) => ({ ...request(selected), fileId: FILE_ID })

  it('sends only the missing or mis-sized parts, then completes', async () => {
    rememberCurrentFile()
    vi.mocked(listFileParts).mockResolvedValue(
      remoteParts([
        { partNumber: 1, size: 10 },
        { partNumber: 2, size: 4 },
      ]),
    )

    await resumeFile(resumeRequest())

    expect(sentPartNumbers().sort()).toEqual([2, 3])
    expect(completeFileUpload).toHaveBeenCalledWith(SHARE_ID, FILE_ID)
    expect(recallUpload(FILE_ID)).toBeUndefined()
  })

  it('uses the remembered hash instead of computing it again', async () => {
    rememberCurrentFile()
    vi.mocked(listFileParts).mockResolvedValue(remoteParts([]))

    await resumeFile(resumeRequest())

    expect(hashFile).not.toHaveBeenCalled()
  })

  it('counts what already arrived in the progress', async () => {
    rememberCurrentFile()
    vi.mocked(listFileParts).mockResolvedValue(remoteParts([{ partNumber: 1, size: 10 }]))
    const resume = resumeRequest()

    await resumeFile(resume)

    expect(resume.observer.onSent).toHaveBeenNthCalledWith(1, 10)
  })

  it('completes directly when every part already arrived', async () => {
    rememberCurrentFile()
    vi.mocked(listFileParts).mockResolvedValue(
      remoteParts([
        { partNumber: 1, size: 10 },
        { partNumber: 2, size: 10 },
        { partNumber: 3, size: 5 },
      ]),
    )

    await resumeFile(resumeRequest())

    expect(uploadFilePart).not.toHaveBeenCalled()
    expect(completeFileUpload).toHaveBeenCalledOnce()
  })

  it.each([
    ['name', file(CONTENT, 'other.mp4')],
    ['size', file(`${CONTENT}y`)],
    ['modification date', file(CONTENT, 'video.mp4', 2000)],
  ])('refuses a file with a different %s without sending anything', async (_, selected) => {
    rememberCurrentFile()
    vi.mocked(listFileParts).mockResolvedValue(remoteParts([]))

    await expect(resumeFile(resumeRequest(selected))).rejects.toBeInstanceOf(DifferentFileError)

    expect(uploadFilePart).not.toHaveBeenCalled()
    expect(completeFileUpload).not.toHaveBeenCalled()
  })

  describe('without a local entry', () => {
    it('computes the hash again and resumes when it matches the announced one', async () => {
      vi.mocked(listFileParts).mockResolvedValue(remoteParts([{ partNumber: 1, size: 10 }]))

      await resumeFile(resumeRequest())

      expect(hashFile).toHaveBeenCalledOnce()
      expect(sentPartNumbers().sort()).toEqual([2, 3])
    })

    it('refuses a file whose hash differs from the announced one', async () => {
      vi.mocked(hashFile).mockResolvedValue('cd'.repeat(32))
      vi.mocked(listFileParts).mockResolvedValue(remoteParts([]))

      await expect(resumeFile(resumeRequest())).rejects.toBeInstanceOf(DifferentFileError)

      expect(uploadFilePart).not.toHaveBeenCalled()
    })

    it('refuses a file of another size before hashing it', async () => {
      vi.mocked(listFileParts).mockResolvedValue(remoteParts([], 999))

      await expect(resumeFile(resumeRequest())).rejects.toBeInstanceOf(DifferentFileError)

      expect(hashFile).not.toHaveBeenCalled()
    })

    it('remembers the file so a later resume skips the hash', async () => {
      vi.mocked(listFileParts).mockResolvedValue(remoteParts([]))
      vi.mocked(uploadFilePart).mockRejectedValue(httpError(409))

      await expect(resumeFile(resumeRequest())).rejects.toBeInstanceOf(AxiosError)

      expect(recallUpload(FILE_ID)?.sha256).toBe(SHA256)
    })
  })

  it('passes on a 409 for a file that is no longer uploading', async () => {
    vi.mocked(listFileParts).mockRejectedValue(httpError(409))

    await expect(resumeFile(resumeRequest())).rejects.toMatchObject({ response: { status: 409 } })

    expect(hashFile).not.toHaveBeenCalled()
  })
})

describe('with another upload target', () => {
  const TOKEN = 'token-123'
  const PROOF = 'proof-456'

  function fakeTarget(): UploadTarget {
    return {
      beforeAnnounce: vi.fn().mockResolvedValue(PROOF),
      announce: vi.fn().mockResolvedValue({ fileId: FILE_ID, partSize: PART_SIZE, uploadToken: TOKEN }),
      listParts: vi.fn(),
      sendPart: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(),
    }
  }

  function requestFor(target: UploadTarget, signal = new AbortController().signal) {
    return { ...request(file(), signal), target }
  }

  it('hashes, then waits for the hook, then announces with its proof', async () => {
    const target = fakeTarget()
    await uploadNewFile(requestFor(target))

    const hookOrder = vi.mocked(target.beforeAnnounce!).mock.invocationCallOrder[0]
    expect(vi.mocked(hashFile).mock.invocationCallOrder[0]).toBeLessThan(hookOrder)
    expect(hookOrder).toBeLessThan(vi.mocked(target.announce).mock.invocationCallOrder[0])
    expect(target.announce).toHaveBeenCalledWith({ name: 'video.mp4', size: 25, sha256: SHA256 }, PROOF)
    expect(startFileUpload).not.toHaveBeenCalled()
    expect(uploadFilePart).not.toHaveBeenCalled()
  })

  it('replays the token on every call, reports it and stores it for a later resume', async () => {
    const target = fakeTarget()
    vi.mocked(target.sendPart).mockImplementation(() => {
      expect(recallUpload(FILE_ID)?.uploadToken).toBe(TOKEN)
      return Promise.resolve()
    })
    const upload = requestFor(target)

    await uploadNewFile(upload)

    const handle = { fileId: FILE_ID, uploadToken: TOKEN }
    expect(target.sendPart).toHaveBeenCalledTimes(3)
    for (const [sent] of vi.mocked(target.sendPart).mock.calls) {
      expect(sent).toEqual(handle)
    }
    expect(target.complete).toHaveBeenCalledWith(handle)
    expect(upload.observer.onTokenIssued).toHaveBeenCalledWith(TOKEN)
  })

  it('reports no token when the announce returned none', async () => {
    const target = fakeTarget()
    vi.mocked(target.announce).mockResolvedValue({ fileId: FILE_ID, partSize: PART_SIZE })
    const upload = requestFor(target)

    await uploadNewFile(upload)

    expect(upload.observer.onTokenIssued).not.toHaveBeenCalled()
  })

  it('cancels while the hook never settles, without announcing', async () => {
    const target = fakeTarget()
    vi.mocked(target.beforeAnnounce!).mockReturnValue(new Promise(() => {}))
    const controller = new AbortController()

    const upload = uploadNewFile(requestFor(target, controller.signal))
    await vi.waitFor(() => expect(target.beforeAnnounce).toHaveBeenCalledWith(controller.signal))
    controller.abort()

    await expect(upload).rejects.toBeInstanceOf(UploadCanceledError)
    expect(target.announce).not.toHaveBeenCalled()
  })

  it('fails with the error of the hook, without announcing', async () => {
    const target = fakeTarget()
    const failure = new Error('no proof')
    vi.mocked(target.beforeAnnounce!).mockRejectedValue(failure)

    await expect(uploadNewFile(requestFor(target))).rejects.toBe(failure)

    expect(target.announce).not.toHaveBeenCalled()
  })

  it('replays the remembered token when resuming', async () => {
    const target = fakeTarget()
    vi.mocked(target.listParts).mockResolvedValue(remoteParts([{ partNumber: 1, size: 10 }]))
    rememberCurrentFile()

    await resumeFile({ ...requestFor(target), fileId: FILE_ID, uploadToken: TOKEN })

    const handle = { fileId: FILE_ID, uploadToken: TOKEN }
    expect(target.listParts).toHaveBeenCalledWith(handle)
    expect(vi.mocked(target.sendPart).mock.calls.map(([sent]) => sent)).toEqual([handle, handle])
    expect(target.complete).toHaveBeenCalledWith(handle)
  })
})
