import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface PublicShareFile {
  id: string
  name: string
  size: number
}

export interface PublicShare {
  id: string
  expiresAt: string | null
  fileCount: number
  totalSize: number
  files: PublicShareFile[]
}

interface ShareDownload {
  url: string
}

function publicSharePath(id: string): string {
  return `/public/shares/${encodeURIComponent(id)}`
}

export async function getPublicShare(id: string, signal?: AbortSignal): Promise<PublicShare> {
  const { data } = await apiClient.get<ResponseDto<PublicShare>>(publicSharePath(id), { signal })
  return data.data
}

export async function requestShareDownload(id: string, fileId: string, turnstileToken?: string): Promise<string> {
  const { data } = await apiClient.post<ResponseDto<ShareDownload>>(
    `${publicSharePath(id)}/files/${encodeURIComponent(fileId)}/download`,
    { turnstileToken },
  )
  return data.data.url
}
