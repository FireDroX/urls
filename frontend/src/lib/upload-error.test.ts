import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from '#lib/api-errors'
import { DifferentFileError, UploadCanceledError } from '#lib/share-errors'
import { toUploadError } from './upload-error'
import { UploadRequestError } from './upload-request-error'

const TOKEN = 'secret-upload-token'

function axiosError(status: number, data: unknown, headers: Record<string, string> = {}): AxiosError {
  const config = { headers: new AxiosHeaders({ 'X-Upload-Token': TOKEN }) }
  const response = { status, data, headers: new AxiosHeaders(headers), statusText: '', config } as AxiosResponse
  return new AxiosError('failed', undefined, config, { headers: config.headers }, response)
}

describe('toUploadError', () => {
  it('keeps only the status, the server message and the delay of an axios error', () => {
    const error = toUploadError(axiosError(429, { error: 'slow down' }, { 'retry-after': '12' }))

    expect(error).toBeInstanceOf(UploadRequestError)
    expect({ ...(error as UploadRequestError) }).toMatchObject({ status: 429, serverMessage: 'slow down', retryAfter: 12 })
    expect(JSON.stringify(error)).not.toContain(TOKEN)
  })

  it('handles an error without response', () => {
    const error = toUploadError(new AxiosError('Network Error'))

    expect({ ...(error as UploadRequestError) }).toMatchObject({ status: null, serverMessage: null, retryAfter: null })
  })

  it.each([new UploadCanceledError(), new DifferentFileError(), new Error('boom')])(
    'returns %s unchanged',
    (error) => {
      expect(toUploadError(error)).toBe(error)
    },
  )
})

describe('extractErrorMessage with an upload request error', () => {
  it('maps the status like an axios error', () => {
    const error = toUploadError(axiosError(413, { error: 'Too big' }))

    expect(extractErrorMessage(error, 'fallback', { 413: 'mapped' })).toBe('mapped')
  })

  it('falls back to the server message then to the fallback', () => {
    expect(extractErrorMessage(toUploadError(axiosError(500, { error: 'Oops' })), 'fallback')).toBe('Oops')
    expect(extractErrorMessage(toUploadError(axiosError(500, {})), 'fallback')).toBe('fallback')
  })

  it('shows the Retry-After delay of a 429, or not', () => {
    expect(extractErrorMessage(toUploadError(axiosError(429, {}, { 'retry-after': '42' })))).toBe(
      'Trop de requêtes, réessayez dans 42 s.',
    )
    expect(extractErrorMessage(toUploadError(axiosError(429, {})))).toBe(
      'Trop de requêtes, réessayez dans un instant.',
    )
  })
})
