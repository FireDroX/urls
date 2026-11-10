import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from '#lib/api-errors'
import i18n from '#lib/i18n'
import { dropErrorMessages } from './drop-errors'

const t = i18n.t.bind(i18n)

function apiError(status: number, headers: Record<string, string> = {}): AxiosError {
  const response = {
    status,
    data: { error: 'english message from the API' },
    headers: new AxiosHeaders(headers),
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse
  return new AxiosError('failed', undefined, undefined, undefined, response)
}

describe('dropErrorMessages', () => {
  it.each([
    [400, 'Titre, slug, limite ou expiration invalide.'],
    [404, "Ce dépôt n'existe plus."],
    [409, 'Ce slug est déjà pris.'],
  ])('translates %i', (status, message) => {
    expect(extractErrorMessage(apiError(status), undefined, dropErrorMessages(t))).toBe(message)
  })

  it('translates a throttled creation with the delay', () => {
    const error = apiError(429, { 'retry-after': '12' })

    expect(extractErrorMessage(error, undefined, dropErrorMessages(t))).toBe(
      'Trop de requêtes, réessayez dans 12 s.',
    )
  })

  it('translates a throttled creation without delay', () => {
    expect(extractErrorMessage(apiError(429), undefined, dropErrorMessages(t))).toBe(
      'Trop de requêtes, réessayez dans un instant.',
    )
  })
})
