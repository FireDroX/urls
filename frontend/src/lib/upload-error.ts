import { isAxiosError } from 'axios'
import { retryAfterSeconds } from '#lib/api-errors'
import { UploadRequestError } from '#lib/upload-request-error'

export function toUploadError(error: unknown): unknown {
  if (!isAxiosError(error)) {
    return error
  }
  const serverMessage: unknown = error.response?.data?.error
  return new UploadRequestError(
    error.response?.status ?? null,
    typeof serverMessage === 'string' ? serverMessage : null,
    retryAfterSeconds(error),
  )
}
