import { isAxiosError } from 'axios'
import i18n from '#lib/i18n'
import { UploadRequestError } from '#lib/upload-request-error'

const TOO_MANY_REQUESTS = 429

interface ErrorSummary {
  status: number | undefined
  serverMessage: string | undefined
  retryAfter: number | null
}

export function retryAfterSeconds(error: unknown): number | null {
  if (error instanceof UploadRequestError) {
    return error.retryAfter
  }
  if (!isAxiosError(error)) {
    return null
  }
  const value = Number(error.response?.headers['retry-after'])
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null
}

export function summarizeError(error: unknown): ErrorSummary | null {
  if (error instanceof UploadRequestError) {
    return {
      status: error.status ?? undefined,
      serverMessage: error.serverMessage ?? undefined,
      retryAfter: error.retryAfter,
    }
  }
  if (!isAxiosError(error)) {
    return null
  }
  const serverMessage: unknown = error.response?.data?.error
  return {
    status: error.response?.status,
    serverMessage: typeof serverMessage === 'string' ? serverMessage : undefined,
    retryAfter: retryAfterSeconds(error),
  }
}

export type MessagesByStatus = Partial<Record<number, string>>

export function extractErrorMessage(
  error: unknown,
  fallback = i18n.t('errors.generic'),
  messagesByStatus: MessagesByStatus = {},
): string {
  const summary = summarizeError(error)
  if (!summary) {
    return fallback
  }
  if (summary.status === TOO_MANY_REQUESTS) {
    return summary.retryAfter === null
      ? i18n.t('errors.tooManyRequestsNoDelay')
      : i18n.t('errors.tooManyRequests', { seconds: summary.retryAfter })
  }
  return messagesByStatus[summary.status ?? 0] || summary.serverMessage || fallback
}
