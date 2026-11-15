import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from '#lib/api-errors'
import i18n from '#lib/i18n'
import { tagErrorMessages } from './tag-errors'

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

describe('tagErrorMessages', () => {
  it.each([
    [400, 'Nom ou couleur de tag invalide.'],
    [404, "Ce tag n'existe plus."],
    [409, 'Un tag porte déjà ce nom.'],
  ])('translates %i', (status, message) => {
    expect(extractErrorMessage(apiError(status), undefined, tagErrorMessages(t))).toBe(message)
  })

  it('translates a throttled request with the delay', () => {
    expect(extractErrorMessage(apiError(429, { 'retry-after': '12' }), undefined, tagErrorMessages(t))).toBe(
      'Trop de requêtes, réessayez dans 12 s.',
    )
  })
})
