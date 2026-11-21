import type { ResponseDto } from '#api/response-dto'
import type { FileStatus } from '#api/shares'
import { apiClient } from '#lib/api-client'

export type StoredFileLinkType = 'redirect' | 'share' | 'drop'

export interface StoredFileLink {
  type: StoredFileLinkType
  publicId: string
  deleted: boolean
  disabled: boolean
  expired: boolean
}

export interface StoredFile {
  publicId: string
  name: string
  size: number
  mime: string | null
  status: FileStatus
  createdAt: string
  completedAt: string | null
  inUse: boolean
  link: StoredFileLink
}

export interface FilesSummary {
  quotaUsedBytes: number
  quotaLimitBytes: number
  orphanBytes: number
  storageUsedBytes: number | null
}

export interface FilesList {
  files: StoredFile[]
  summary: FilesSummary
}

const FILES_PATH = '/files'

function filePath(id: string): string {
  return `${FILES_PATH}/${encodeURIComponent(id)}`
}

export async function listFiles(orphansOnly: boolean): Promise<FilesList> {
  const { data } = await apiClient.get<ResponseDto<FilesList>>(FILES_PATH, {
    params: orphansOnly ? { orphans: 'true' } : undefined,
  })
  return data.data
}

export async function deleteFile(id: string): Promise<void> {
  await apiClient.delete(filePath(id))
}

export async function createFileDownloadUrl(id: string): Promise<string> {
  const { data } = await apiClient.post<ResponseDto<{ url: string }>>(`${filePath(id)}/download`)
  return data.data.url
}
