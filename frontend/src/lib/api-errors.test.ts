import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage, retryAfterSeconds } from './api-errors'

function axiosError(status: number, data: unknown, headers: Record<string, string> = {}): AxiosError {
  const response = {
    status,
    data,
    headers: new AxiosHeaders(headers),
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

describe('extractErrorMessage', () => {
  it('shows the Retry-After delay of a 429', () => {
    const error = axiosError(429, { error: 'ThrottlerException' }, { 'retry-after': '42' })

    expect(extractErrorMessage(error)).toBe('Trop de requêtes, réessayez dans 42 s.')
    expect(retryAfterSeconds(error)).toBe(42)
  })

  it('handles a 429 without Retry-After', () => {
    expect(extractErrorMessage(axiosError(429, {}))).toBe('Trop de requêtes, réessayez dans un instant.')
  })

  it('returns the API error message', () => {
    expect(extractErrorMessage(axiosError(401, { error: 'Invalid email or password' }))).toBe(
      'Invalid email or password',
    )
  })

  it('prefers the translated message given for the status', () => {
    const error = axiosError(409, { error: 'Slug already taken' })

    expect(extractErrorMessage(error, undefined, { 409: 'Slug pris' })).toBe('Slug pris')
  })

  it('keeps the Retry-After message of a 429 over a status message', () => {
    const error = axiosError(429, {}, { 'retry-after': '7' })

    expect(extractErrorMessage(error, undefined, { 429: 'ignored' })).toBe('Trop de requêtes, réessayez dans 7 s.')
  })

  it('falls back to a generic message for anything else', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('Une erreur est survenue, réessayez.')
  })
})
