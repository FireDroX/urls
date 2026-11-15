import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface Folder {
  id: string
  name: string
  linkCount: number
  createdAt: string
  updatedAt: string
}

export interface FolderPayload {
  name: string
}

const FOLDERS_PATH = '/folders'

function folderApiPath(id: string): string {
  return `${FOLDERS_PATH}/${encodeURIComponent(id)}`
}

export async function listFolders(): Promise<Folder[]> {
  const { data } = await apiClient.get<ResponseDto<Folder[]>>(FOLDERS_PATH)
  return data.data
}

export async function createFolder(payload: FolderPayload): Promise<Folder> {
  const { data } = await apiClient.post<ResponseDto<Folder>>(FOLDERS_PATH, payload)
  return data.data
}

export async function updateFolder(id: string, payload: FolderPayload): Promise<Folder> {
  const { data } = await apiClient.patch<ResponseDto<Folder>>(folderApiPath(id), payload)
  return data.data
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.delete(folderApiPath(id))
}
