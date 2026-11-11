import type { ResponseDto } from '#api/response-dto'
import type { ShareFile } from '#api/shares'
import { publicApiClient } from '#lib/public-api-client'
import type { AnnouncedFile, PartOptions, ReceivedParts, UploadHandle } from '#lib/upload-target'

export const DROP_UPLOAD_TOKEN_HEADER = 'X-Upload-Token'

const PART_CONTENT_TYPE = 'application/octet-stream'

export interface PublicDrop {
  id: string
  title: string | null
  maxFiles: number
  maxTotalBytes: number
  filesRemaining: number
  bytesRemaining: number
  expiresAt: string | null
}

export type DropFile = ShareFile

export interface DropUploadAnnounce extends AnnouncedFile {
  turnstileToken?: string
  uploaderName: string | null
}

export interface DropUploadStarted {
  fileId: string
  partSize: number
  partCount: number
  uploadToken: string
  file: DropFile
}

function dropPath(id: string): string {
  return `/public/drops/${encodeURIComponent(id)}`
}

function filePath(id: string, fileId: string): string {
  return `${dropPath(id)}/files/${encodeURIComponent(fileId)}`
}

function tokenHeaders({ uploadToken }: UploadHandle): Record<string, string> {
  return uploadToken ? { [DROP_UPLOAD_TOKEN_HEADER]: uploadToken } : {}
}

export function dropUploadUrl(id: string, origin = window.location.origin): string {
  return `${origin}/u/${encodeURIComponent(id)}`
}

export async function getPublicDrop(id: string, signal?: AbortSignal): Promise<PublicDrop> {
  const { data } = await publicApiClient.get<ResponseDto<PublicDrop>>(dropPath(id), { signal })
  return data.data
}

export async function announceDropUpload(
  id: string,
  { turnstileToken, uploaderName, ...file }: DropUploadAnnounce,
): Promise<DropUploadStarted> {
  const { data } = await publicApiClient.post<ResponseDto<DropUploadStarted>>(`${dropPath(id)}/files`, {
    ...file,
    turnstileToken: turnstileToken || undefined,
    uploaderName: uploaderName || undefined,
  })
  return data.data
}

export async function getDropFile(id: string, handle: UploadHandle): Promise<DropFile> {
  const { data } = await publicApiClient.get<ResponseDto<DropFile>>(filePath(id, handle.fileId), {
    headers: tokenHeaders(handle),
  })
  return data.data
}

export async function listDropParts(id: string, handle: UploadHandle): Promise<ReceivedParts> {
  const { data } = await publicApiClient.get<ResponseDto<ReceivedParts>>(`${filePath(id, handle.fileId)}/parts`, {
    headers: tokenHeaders(handle),
  })
  return data.data
}

export async function uploadDropPart(
  id: string,
  handle: UploadHandle,
  partNumber: number,
  body: Blob,
  { signal, onProgress }: PartOptions,
): Promise<void> {
  await publicApiClient.put(`${filePath(id, handle.fileId)}/parts/${partNumber}`, body, {
    headers: { 'Content-Type': PART_CONTENT_TYPE, ...tokenHeaders(handle) },
    signal,
    onUploadProgress: ({ loaded }) => onProgress(loaded),
  })
}

export async function completeDropUpload(id: string, handle: UploadHandle): Promise<void> {
  await publicApiClient.post(`${filePath(id, handle.fileId)}/complete`, undefined, { headers: tokenHeaders(handle) })
}

export async function cancelDropUpload(id: string, handle: UploadHandle): Promise<void> {
  await publicApiClient.delete(filePath(id, handle.fileId), { headers: tokenHeaders(handle) })
}
