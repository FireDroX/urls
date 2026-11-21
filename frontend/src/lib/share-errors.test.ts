import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import i18n from '#lib/i18n'
import { extractErrorMessage } from '#lib/api-errors'
import {
  DifferentFileError,
  FileHashError,
  shareErrorMessages,
  shareFileErrorMessages,
  uploadErrorMessage,
} from './share-errors'

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

describe('shareErrorMessages', () => {
  it.each([
    [400, 'Slug, expiration ou limite invalide.'],
    [404, "Ce partage n'existe plus."],
    [409, 'Ce slug est déjà pris.'],
  ])('translates a %i', (status, message) => {
    expect(extractErrorMessage(apiError(status), undefined, shareErrorMessages(t))).toBe(message)
  })
})

describe('shareFileErrorMessages', () => {
  it('has a message for every client error of the upload routes', () => {
    expect(Object.keys(shareFileErrorMessages(t))).toEqual(['400', '404', '409', '413', '503'])
  })
})

describe('uploadErrorMessage', () => {
  it.each([
    [400, 'Ce fichier a été refusé : nom, taille ou part invalide.'],
    [404, "Ce fichier ou ce partage n'existe plus."],
    [409, "Cet envoi n'est plus en cours, ou des parts manquent encore."],
    [413, 'Trop volumineux : limite du fichier, du partage ou du stockage atteinte.'],
    [503, 'Le stockage est injoignable, réessayez dans un instant.'],
  ])('translates a %i and never shows the API message', (status, message) => {
    expect(uploadErrorMessage(apiError(status), t)).toBe(message)
  })

  it('gives the delay of a 429', () => {
    expect(uploadErrorMessage(apiError(429, { 'retry-after': '12' }), t)).toBe('Trop de requêtes, réessayez dans 12 s.')
  })

  it('suggests resuming after a network failure', () => {
    const message = uploadErrorMessage(new AxiosError('Network Error', AxiosError.ERR_NETWORK), t)

    expect(message).toBe('Envoi interrompu : vérifiez votre connexion, puis reprenez-le.')
  })

  it('explains that another file was selected', () => {
    expect(uploadErrorMessage(new DifferentFileError(), t)).toBe(
      "Ce n'est pas le fichier de l'envoi interrompu : rien n'a été envoyé.",
    )
  })

  it('explains an unreadable file', () => {
    expect(uploadErrorMessage(new FileHashError(), t)).toBe('Impossible de lire ce fichier.')
  })
})
