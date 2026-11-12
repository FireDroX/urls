import type { ResponseDto } from '#api/response-dto'
import type { CreateSharePayload, FileStatus, ShareDetail } from '#api/shares'
import { apiClient } from '#lib/api-client'

export type DropState = 'open' | 'full' | 'expired' | 'disabled'

export interface Drop {
  id: string
  title: string | null
  maxTotalBytes: number
  maxFiles: number
  expiresAt: string | null
  disabled: boolean
  fileCount: number
  totalSize: number
  state: DropState
  createdAt: string
  updatedAt: string
}

export interface DropFile {
  id: string
  name: string
  size: number
  mime: string | null
  status: FileStatus
  uploaderName: string | null
  createdAt: string
  completedAt: string | null
}

export interface DropDetail extends Drop {
  viewCount: number
  files: DropFile[]
}

export interface CreateDropPayload {
  slug?: string
  title?: string | null
  expiresAt?: string | null
  maxFiles: number
  maxTotalBytes: number
}

export interface UpdateDropPayload extends Partial<CreateDropPayload> {
  disabled?: boolean
}

const DROPS_PATH = '/drops'

function dropApiPath(id: string): string {
  return `${DROPS_PATH}/${encodeURIComponent(id)}`
}

export function dropDetailPath(id: string): string {
  return `/drops/${encodeURIComponent(id)}`
}

export function dropPath(id: string): string {
  return `/u/${encodeURIComponent(id)}`
}

export function dropUrl(id: string, origin = window.location.origin): string {
  return `${origin}${dropPath(id)}`
}

export async function listDrops(): Promise<Drop[]> {
  const { data } = await apiClient.get<ResponseDto<Drop[]>>(DROPS_PATH)
  return data.data
}

export async function getDrop(id: string, signal?: AbortSignal): Promise<DropDetail> {
  const { data } = await apiClient.get<ResponseDto<DropDetail>>(dropApiPath(id), { signal })
  return data.data
}

export async function createDrop(payload: CreateDropPayload): Promise<Drop> {
  const { data } = await apiClient.post<ResponseDto<Drop>>(DROPS_PATH, payload)
  return data.data
}

export async function updateDrop(id: string, payload: UpdateDropPayload): Promise<Drop> {
  const { data } = await apiClient.patch<ResponseDto<Drop>>(dropApiPath(id), payload)
  return data.data
}

export async function deleteDrop(id: string): Promise<void> {
  await apiClient.delete(dropApiPath(id))
}

export async function deleteDropFile(id: string, fileId: string): Promise<void> {
  await apiClient.delete(`${dropApiPath(id)}/files/${encodeURIComponent(fileId)}`)
}

export type ShareDropFilesPayload = CreateSharePayload & { fileIds: string[]; closeDrop: boolean }

export async function shareDropFiles(id: string, payload: ShareDropFilesPayload): Promise<ShareDetail> {
  const { data } = await apiClient.post<ResponseDto<ShareDetail>>(`${dropApiPath(id)}/share`, payload)
  return data.data
}
