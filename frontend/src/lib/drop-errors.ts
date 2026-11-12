import { isAxiosError } from 'axios'
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

export function dropFileDeleteErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [NOT_FOUND]: t('drops.errors.fileNotFound'),
    [SERVICE_UNAVAILABLE]: t('drops.errors.storageUnavailable'),
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

const FILE_NOT_READY_MESSAGE = 'File is not ready'

function isFileNotReady(error: unknown): boolean {
  return isAxiosError(error) && error.response?.data?.error === FILE_NOT_READY_MESSAGE
}

export function isShareDropFilesStale(error: unknown): boolean {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return status === NOT_FOUND || (status === CONFLICT && isFileNotReady(error))
}

export function shareDropFilesErrorMessage(t: TFunction, error: unknown): string {
  return extractErrorMessage(error, undefined, {
    [BAD_REQUEST]: t('drops.share.errors.invalid'),
    [NOT_FOUND]: t('drops.share.errors.notFound'),
    [CONFLICT]: isFileNotReady(error) ? t('drops.share.errors.notReady') : t('drops.errors.slugTaken'),
  })
}
