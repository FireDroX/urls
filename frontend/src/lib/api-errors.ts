import { isAxiosError, type AxiosError } from 'axios'
import i18n from '#lib/i18n'

const TOO_MANY_REQUESTS = 429

export function retryAfterSeconds(error: unknown): number | null {
  if (!isAxiosError(error)) {
    return null
  }
  const value = Number(error.response?.headers['retry-after'])
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null
}

export function extractErrorMessage(error: unknown, fallback = i18n.t('errors.generic')): string {
  if (isAxiosError(error) && error.response?.status === TOO_MANY_REQUESTS) {
    return tooManyRequestsMessage(error)
  }
  if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
    return error.response.data.error
  }
  return fallback
}

function tooManyRequestsMessage(error: AxiosError): string {
  const seconds = retryAfterSeconds(error)
  return seconds === null ? i18n.t('errors.tooManyRequestsNoDelay') : i18n.t('errors.tooManyRequests', { seconds })
}
