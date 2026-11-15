import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from '#lib/api-errors'
import i18n from '#lib/i18n'
import { folderErrorMessages } from './folder-errors'

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

describe('folderErrorMessages', () => {
  it.each([
    [400, 'Nom de dossier invalide.'],
    [404, "Ce dossier n'existe plus."],
    [409, 'Un dossier porte déjà ce nom.'],
  ])('translates %i', (status, message) => {
    expect(extractErrorMessage(apiError(status), undefined, folderErrorMessages(t))).toBe(message)
  })

  it('translates a throttled request with the delay', () => {
    expect(extractErrorMessage(apiError(429, { 'retry-after': '12' }), undefined, folderErrorMessages(t))).toBe(
      'Trop de requêtes, réessayez dans 12 s.',
    )
  })
})
