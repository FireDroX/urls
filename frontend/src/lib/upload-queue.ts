import { isAxiosError } from 'axios'
import { UploadCanceledError } from '#lib/share-errors'
import { resumeFile, uploadNewFile, type TransferPhase, type UploadObserver } from '#lib/share-upload'
import { toUploadError } from '#lib/upload-error'
import type { UploadTargetResolver } from '#lib/upload-target'
import { forgetUpload, recallUpload } from '#utils/pending-uploads'

export type UploadPhase = 'queued' | TransferPhase | 'canceling' | 'failed'

export interface UploadItem {
  key: string
  shareId: string
  fileId: string | null
  uploadToken?: string
  name: string
  size: number
  phase: UploadPhase
  hashedBytes: number
  sentBytes: number
  error: unknown
}

export interface UploadQueueSnapshot {
  items: readonly UploadItem[]
  revision: number
}

export interface ResumeTarget {
  shareId: string
  fileId: string
}

export interface UploadedFile {
  shareId: string
  fileId: string
  uploadToken?: string
  name: string
  size: number
}

export interface UploadQueueOptions {
  onUploaded?: (upload: UploadedFile) => void
}

type UploadJob = (signal: AbortSignal, observer: UploadObserver) => Promise<void>

const NOT_FOUND = 404

function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === NOT_FOUND
}

export function isActiveUpload(item: UploadItem): boolean {
  return item.phase !== 'failed'
}

export class UploadQueue {
  private snapshot: UploadQueueSnapshot = { items: [], revision: 0 }
  private readonly listeners = new Set<() => void>()
  private readonly jobs = new Map<string, UploadJob>()
  private readonly controllers = new Map<string, AbortController>()
  private nextKey = 1
  private draining = false

  private readonly tokens = new Map<string, string>()
  private readonly targetOf: UploadTargetResolver
  private readonly options: UploadQueueOptions

  constructor(targetOf: UploadTargetResolver, options: UploadQueueOptions = {}) {
    this.targetOf = targetOf
    this.options = options
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): UploadQueueSnapshot => this.snapshot

  addFiles(shareId: string, files: readonly File[]): void {
    for (const file of files) {
      const target = this.targetOf(shareId)
      this.enqueue(shareId, null, file, undefined, (signal, observer) =>
        uploadNewFile({ shareId, target, file, signal, observer }),
      )
    }
  }

  resume({ shareId, fileId }: ResumeTarget, file: File): void {
    this.setItems(this.snapshot.items.filter((item) => item.fileId !== fileId))
    const target = this.targetOf(shareId)
    const uploadToken = this.tokens.get(fileId) ?? recallUpload(fileId)?.uploadToken
    this.enqueue(shareId, fileId, file, uploadToken, (signal, observer) =>
      resumeFile({ shareId, target, fileId, uploadToken, file, signal, observer }),
    )
  }

  cancel(key: string): void {
    const controller = this.controllers.get(key)
    if (controller) {
      this.update(key, { phase: 'canceling' })
      controller.abort()
      return
    }
    this.jobs.delete(key)
    this.remove(key)
  }

  dismiss(key: string): void {
    this.remove(key)
  }

  async abandon(key: string): Promise<void> {
    const item = this.find(key)
    if (item?.phase === 'failed' && item.fileId) {
      await this.discard(item, item.fileId)
    }
  }

  dismissFailed(fileId: string): void {
    this.setItems(this.snapshot.items.filter((item) => item.fileId !== fileId || isActiveUpload(item)))
  }

  stop(): void {
    this.jobs.clear()
    this.setItems([])
    for (const controller of this.controllers.values()) {
      controller.abort()
    }
  }

  private enqueue(
    shareId: string,
    fileId: string | null,
    file: File,
    uploadToken: string | undefined,
    job: UploadJob,
  ): void {
    const key = String(this.nextKey)
    this.nextKey += 1
    this.jobs.set(key, job)
    this.setItems([
      ...this.snapshot.items,
      {
        key,
        shareId,
        fileId,
        ...(uploadToken === undefined ? {} : { uploadToken }),
        name: file.name,
        size: file.size,
        phase: 'queued',
        hashedBytes: 0,
        sentBytes: 0,
        error: null,
      },
    ])
    void this.drain()
  }

  private nextJob(): [string, UploadJob] | undefined {
    const [next] = this.jobs
    return next
  }

  private async drain(): Promise<void> {
    if (this.draining) {
      return
    }
    this.draining = true
    for (let next = this.nextJob(); next; next = this.nextJob()) {
      const [key, job] = next
      this.jobs.delete(key)
      await this.run(key, job)
    }
    this.draining = false
  }

  private async run(key: string, job: UploadJob): Promise<void> {
    const controller = new AbortController()
    this.controllers.set(key, controller)
    try {
      await job(controller.signal, this.observerOf(key, controller.signal))
      this.finish(key)
      this.bumpRevision()
    } catch (error) {
      await this.settle(key, error)
    } finally {
      this.controllers.delete(key)
    }
  }

  private finish(key: string): void {
    const item = this.find(key)
    if (item?.fileId) {
      this.options.onUploaded?.({
        shareId: item.shareId,
        fileId: item.fileId,
        uploadToken: item.uploadToken,
        name: item.name,
        size: item.size,
      })
      this.tokens.delete(item.fileId)
    }
    this.remove(key)
  }

  private async settle(key: string, error: unknown): Promise<void> {
    const item = this.find(key)
    if (!item) {
      return
    }
    if (!(error instanceof UploadCanceledError)) {
      this.update(key, { phase: 'failed', error: toUploadError(error) })
    } else if (item.fileId === null) {
      this.remove(key)
    } else {
      await this.discard(item, item.fileId)
    }
    this.bumpRevision()
  }

  private async discard({ key, shareId, uploadToken }: UploadItem, fileId: string): Promise<void> {
    try {
      await this.targetOf(shareId).cancel({
        fileId,
        uploadToken: uploadToken ?? this.tokens.get(fileId) ?? recallUpload(fileId)?.uploadToken,
      })
      forgetUpload(fileId)
      this.tokens.delete(fileId)
      this.remove(key)
    } catch (error) {
      if (isNotFound(error)) {
        forgetUpload(fileId)
        this.tokens.delete(fileId)
        this.remove(key)
        return
      }
      this.update(key, { phase: 'failed', error: toUploadError(error) })
    }
  }

  private observerOf(key: string, signal: AbortSignal): UploadObserver {
    return {
      onPhase: (phase) => {
        if (!signal.aborted) this.update(key, { phase })
      },
      onHashed: (hashedBytes) => this.update(key, { hashedBytes }),
      onSent: (sentBytes) => this.update(key, { sentBytes }),
      onTokenIssued: (uploadToken) => {
        this.update(key, { uploadToken })
        const fileId = this.find(key)?.fileId
        if (fileId) this.tokens.set(fileId, uploadToken)
      },
      onOpened: (fileId) => {
        this.update(key, { fileId })
        const uploadToken = this.find(key)?.uploadToken
        if (uploadToken) this.tokens.set(fileId, uploadToken)
      },
    }
  }

  private find(key: string): UploadItem | undefined {
    return this.snapshot.items.find((item) => item.key === key)
  }

  private update(key: string, changes: Partial<UploadItem>): void {
    this.setItems(this.snapshot.items.map((item) => (item.key === key ? { ...item, ...changes } : item)))
  }

  private remove(key: string): void {
    this.setItems(this.snapshot.items.filter((item) => item.key !== key))
  }

  private setItems(items: readonly UploadItem[]): void {
    this.publish({ ...this.snapshot, items })
  }

  private bumpRevision(): void {
    this.publish({ ...this.snapshot, revision: this.snapshot.revision + 1 })
  }

  private publish(snapshot: UploadQueueSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) {
      listener()
    }
  }
}
