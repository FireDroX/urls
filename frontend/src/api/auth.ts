import type { ResponseDto } from '#api/response-dto'
import { apiClient } from '#lib/api-client'

export interface LoginPayload {
  email: string
  password: string
  turnstileToken?: string
}

export interface AuthUser {
  email: string
}

export async function login(payload: LoginPayload): Promise<void> {
  await apiClient.post<ResponseDto<null>>('/auth/login', payload)
}

export async function logout(): Promise<void> {
  await apiClient.post<ResponseDto<null>>('/auth/logout')
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<ResponseDto<AuthUser>>('/auth/me')
  return data.data
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch<ResponseDto<null>>('/auth/password', { currentPassword, newPassword })
}
