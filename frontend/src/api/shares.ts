import type { LinkOrganization, LinkOrganizationPayload } from '#api/link-organization'
import type { ListParams, Page } from '#api/list-params'
import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export type FileStatus = 'uploading' | 'verifying' | 'ready' | 'rejected'

export interface ShareFile {
  id: string
  name: string
  size: number
  mime: string | null
  status: FileStatus
  createdAt: string
  completedAt: string | null
}

export interface Share extends LinkOrganization {
  id: string
  expiresAt: string | null
  maxDownloads: number | null
  downloadCount: number
  disabled: boolean
  fileCount: number
  totalSize: number
  createdAt: string
  updatedAt: string
}

export interface ShareDetail extends Share {
  viewCount: number
  files: ShareFile[]
}

export interface CreateSharePayload extends LinkOrganizationPayload {
  slug?: string
  expiresAt?: string | null
  maxDownloads?: number | null
}

export interface UpdateSharePayload extends CreateSharePayload {
  disabled?: boolean
}

export interface StartUploadPayload {
  name: string
  size: number
  sha256: string
}

export interface UploadStarted {
  fileId: string
  partSize: number
  partCount: number
  file: ShareFile
}

export interface ReceivedPart {
  partNumber: number
  size: number
}

export interface UploadParts {
  fileId: string
  size: number
  sha256: string
  partSize: number
  partCount: number
  parts: ReceivedPart[]
}

export interface PartTransfer {
  signal: AbortSignal
  onProgress: (loadedBytes: number) => void
}

const SHARES_PATH = '/shares'
const PART_CONTENT_TYPE = 'application/octet-stream'

function shareApiPath(id: string): string {
  return `${SHARES_PATH}/${encodeURIComponent(id)}`
}

function fileApiPath(shareId: string, fileId: string): string {
  return `${shareApiPath(shareId)}/files/${encodeURIComponent(fileId)}`
}

export function sharePath(id: string): string {
  return `/d/${encodeURIComponent(id)}`
}

export function shareUrl(id: string, origin = window.location.origin): string {
  return `${origin}${sharePath(id)}`
}

export function shareDetailPath(id: string): string {
  return `/shares/${encodeURIComponent(id)}`
}

export async function listShares(params?: ListParams): Promise<Page<Share>> {
  const { data } = await apiClient.get<ResponseDto<Page<Share>>>(SHARES_PATH, { params })
  return data.data
}

export async function getShare(id: string, signal?: AbortSignal): Promise<ShareDetail> {
  const { data } = await apiClient.get<ResponseDto<ShareDetail>>(shareApiPath(id), { signal })
  return data.data
}

export async function createShare(payload: CreateSharePayload): Promise<ShareDetail> {
  const { data } = await apiClient.post<ResponseDto<ShareDetail>>(SHARES_PATH, payload)
  return data.data
}

export async function updateShare(id: string, payload: UpdateSharePayload): Promise<ShareDetail> {
  const { data } = await apiClient.patch<ResponseDto<ShareDetail>>(shareApiPath(id), payload)
  return data.data
}

export async function deleteShare(id: string): Promise<void> {
  await apiClient.delete(shareApiPath(id))
}

export async function startFileUpload(shareId: string, payload: StartUploadPayload): Promise<UploadStarted> {
  const { data } = await apiClient.post<ResponseDto<UploadStarted>>(`${shareApiPath(shareId)}/files`, payload)
  return data.data
}

export async function listFileParts(shareId: string, fileId: string): Promise<UploadParts> {
  const { data } = await apiClient.get<ResponseDto<UploadParts>>(`${fileApiPath(shareId, fileId)}/parts`)
  return data.data
}

export async function uploadFilePart(
  shareId: string,
  fileId: string,
  partNumber: number,
  body: Blob,
  { signal, onProgress }: PartTransfer,
): Promise<void> {
  await apiClient.put(`${fileApiPath(shareId, fileId)}/parts/${partNumber}`, body, {
    headers: { 'Content-Type': PART_CONTENT_TYPE },
    signal,
    onUploadProgress: ({ loaded }) => onProgress(loaded),
  })
}

export async function completeFileUpload(shareId: string, fileId: string): Promise<ShareFile> {
  const { data } = await apiClient.post<ResponseDto<ShareFile>>(`${fileApiPath(shareId, fileId)}/complete`)
  return data.data
}

export async function deleteShareFile(shareId: string, fileId: string): Promise<void> {
  await apiClient.delete(fileApiPath(shareId, fileId))
}
