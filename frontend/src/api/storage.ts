import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface StorageUsage {
  usedBytes: number | null
  quotaBytes: number | null
}

export async function getStorageUsage(): Promise<StorageUsage> {
  const { data } = await apiClient.get<ResponseDto<StorageUsage>>('/storage/usage')
  return data.data
}
