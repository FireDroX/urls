import { z } from 'zod'

const STORAGE_KEY = 'pending-uploads'

const pendingUploadsSchema = z.array(
  z.object({
    shareId: z.string(),
    fileId: z.string(),
    name: z.string(),
    size: z.number(),
    lastModified: z.number(),
    sha256: z.string(),
  }),
)

export type PendingUpload = z.infer<typeof pendingUploadsSchema>[number]

function readAll(): PendingUpload[] {
  try {
    const parsed = pendingUploadsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
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

export function rememberUpload(upload: PendingUpload): void {
  writeAll([...readAll().filter(({ fileId }) => fileId !== upload.fileId), upload])
}

export function recallUpload(fileId: string): PendingUpload | undefined {
  return readAll().find((upload) => upload.fileId === fileId)
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
