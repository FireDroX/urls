import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface Settings {
  locale: string
}

export async function getSettings(): Promise<Settings> {
  const { data } = await apiClient.get<ResponseDto<Settings>>('/settings')
  return data.data
}

export async function updateSetting(key: keyof Settings, value: string): Promise<Settings> {
  const { data } = await apiClient.patch<ResponseDto<Settings>>(`/settings/${key}`, { value })
  return data.data
}
