import { z } from 'zod'

const STORAGE_KEY = 'pending-uploads'

export const PENDING_UPLOAD_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

const pendingUploadsSchema = z.array(
  z.object({
    shareId: z.string(),
    fileId: z.string(),
    name: z.string(),
    size: z.number(),
    lastModified: z.number(),
    sha256: z.string(),
    uploadToken: z.string().optional(),
    savedAt: z.number().optional(),
  }),
)

export type PendingUpload = z.infer<typeof pendingUploadsSchema>[number]

function isExpired(upload: PendingUpload, now: number): boolean {
  return (
    upload.uploadToken !== undefined &&
    (upload.savedAt === undefined || upload.savedAt + PENDING_UPLOAD_TOKEN_TTL_MS <= now)
  )
}

function readAll(): PendingUpload[] {
  try {
    const parsed = pendingUploadsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function readFresh(): PendingUpload[] {
  const now = Date.now()
  return readAll().filter((upload) => !isExpired(upload, now))
}

function writeAll(uploads: PendingUpload[]): void {
  try {
    if (uploads.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads))
    }
  } catch {
    return
  }
}

export function rememberUpload(upload: Omit<PendingUpload, 'savedAt'>): void {
  writeAll([...readAll().filter(({ fileId }) => fileId !== upload.fileId), { ...upload, savedAt: Date.now() }])
}

export function recallUpload(fileId: string): PendingUpload | undefined {
  return readFresh().find((upload) => upload.fileId === fileId)
}

export function pendingUploadsOf(shareId: string): PendingUpload[] {
  return readFresh().filter((upload) => upload.shareId === shareId)
}

export function purgeExpiredUploads(now = Date.now()): void {
  const all = readAll()
  const kept = all.filter((upload) => !isExpired(upload, now))
  if (kept.length !== all.length) {
    writeAll(kept)
  }
}

export function forgetUpload(fileId: string): void {
  writeAll(readAll().filter((upload) => upload.fileId !== fileId))
}

export function forgetShareUploads(shareId: string, keptFileIds: ReadonlySet<string> = new Set()): void {
  writeAll(readAll().filter((upload) => upload.shareId !== shareId || keptFileIds.has(upload.fileId)))
}

export function isSameFile(upload: PendingUpload, file: File): boolean {
  return upload.name === file.name && upload.size === file.size && upload.lastModified === file.lastModified
}
