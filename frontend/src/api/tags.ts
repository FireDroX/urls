import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface Tag {
  id: string
  name: string
  color: string
  linkCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateTagPayload {
  name: string
  color?: string
}

export type UpdateTagPayload = Partial<CreateTagPayload>

const TAGS_PATH = '/tags'

function tagApiPath(id: string): string {
  return `${TAGS_PATH}/${encodeURIComponent(id)}`
}

export async function listTags(): Promise<Tag[]> {
  const { data } = await apiClient.get<ResponseDto<Tag[]>>(TAGS_PATH)
  return data.data
}

export async function createTag(payload: CreateTagPayload): Promise<Tag> {
  const { data } = await apiClient.post<ResponseDto<Tag>>(TAGS_PATH, payload)
  return data.data
}

export async function updateTag(id: string, payload: UpdateTagPayload): Promise<Tag> {
  const { data } = await apiClient.patch<ResponseDto<Tag>>(tagApiPath(id), payload)
  return data.data
}

export async function deleteTag(id: string): Promise<void> {
  await apiClient.delete(tagApiPath(id))
}
