export interface UploadHandle {
  fileId: string
  uploadToken?: string
}

export interface AnnouncedFile {
  name: string
  size: number
  sha256: string
}

export interface AnnouncedUpload {
  fileId: string
  partSize: number
  uploadToken?: string
}

export interface ReceivedParts {
  size: number
  sha256: string
  partSize: number
  parts: { partNumber: number; size: number }[]
}

export interface PartOptions {
  signal: AbortSignal
  onProgress: (loadedBytes: number) => void
}

export interface UploadTarget {
  beforeAnnounce?: (signal: AbortSignal) => Promise<string>
  announce: (file: AnnouncedFile, proof?: string) => Promise<AnnouncedUpload>
  listParts: (handle: UploadHandle) => Promise<ReceivedParts>
  sendPart: (handle: UploadHandle, partNumber: number, body: Blob, options: PartOptions) => Promise<unknown>
  complete: (handle: UploadHandle) => Promise<unknown>
  cancel: (handle: UploadHandle) => Promise<unknown>
}

export type UploadTargetResolver = (shareId: string) => UploadTarget
