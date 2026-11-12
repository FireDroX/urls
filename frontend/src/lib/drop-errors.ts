import type { TFunction } from 'i18next'
import { extractErrorMessage, type MessagesByStatus } from '#lib/api-errors'
import { DifferentFileError, FileHashError } from '#lib/share-errors'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409
const GONE = 410
const PAYLOAD_TOO_LARGE = 413
const SERVICE_UNAVAILABLE = 503

export function dropErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('drops.errors.invalid'),
    [NOT_FOUND]: t('drops.errors.notFound'),
    [CONFLICT]: t('drops.errors.slugTaken'),
  }
}

export function dropUploadErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof DifferentFileError) {
    return t('dropUpload.errors.differentFile')
  }
  if (error instanceof FileHashError) {
    return t('dropUpload.errors.hashFailed')
  }
  return extractErrorMessage(error, t('dropUpload.errors.interrupted'), {
    [BAD_REQUEST]: t('dropUpload.errors.verificationFailed'),
    [NOT_FOUND]: t('dropUpload.errors.notFound'),
    [GONE]: t('dropUpload.errors.closed'),
    [PAYLOAD_TOO_LARGE]: t('dropUpload.errors.noRoom'),
    [SERVICE_UNAVAILABLE]: t('dropUpload.errors.storageUnavailable'),
  })
}
