import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from '#lib/api-errors'
import i18n from '#lib/i18n'
import { DifferentFileError, FileHashError } from '#lib/share-errors'
import { dropErrorMessages, dropFileDeleteErrorMessages, dropUploadErrorMessage } from './drop-errors'
import { toUploadError } from './upload-error'

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

describe('dropFileDeleteErrorMessages', () => {
  it.each([
    [404, "Ce fichier n'existe plus."],
    [503, 'Le stockage est injoignable. Le fichier est conservé, réessayez plus tard.'],
  ])('translates %i', (status, message) => {
    expect(extractErrorMessage(apiError(status), undefined, dropFileDeleteErrorMessages(t))).toBe(message)
  })
})

describe('dropUploadErrorMessage', () => {
  it.each([
    [400, 'La vérification a échoué, réessayez.'],
    [404, 'Cet envoi est introuvable, il a peut-être été annulé.'],
    [410, 'Le dépôt est fermé.'],
    [413, 'Ce fichier est trop gros ou il ne reste pas assez de place dans le dépôt.'],
    [503, 'Le stockage est injoignable, réessayez dans un instant.'],
    [500, "L'envoi a été interrompu."],
  ])('translates %i, raw or sanitized', (status, message) => {
    const raw = apiError(status)
    raw.response!.data = {}

    expect(dropUploadErrorMessage(raw, t)).toBe(message)
    expect(dropUploadErrorMessage(toUploadError(raw), t)).toBe(message)
  })

  it('translates a different file and a read failure', () => {
    expect(dropUploadErrorMessage(new DifferentFileError(), t)).toBe(
      "Ce fichier n'est pas celui dont l'envoi a été interrompu.",
    )
    expect(dropUploadErrorMessage(new FileHashError(), t)).toBe("Le fichier n'a pas pu être lu.")
  })

  it('shows the Retry-After delay of a 429', () => {
    expect(dropUploadErrorMessage(toUploadError(apiError(429, { 'retry-after': '8' })), t)).toBe(
      'Trop de requêtes, réessayez dans 8 s.',
    )
  })
})
