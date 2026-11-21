import type { TFunction } from 'i18next'
import { extractErrorMessage, type MessagesByStatus } from '#lib/api-errors'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409
const PAYLOAD_TOO_LARGE = 413
const SERVICE_UNAVAILABLE = 503

export class UploadCanceledError extends Error {
  constructor() {
    super('Upload canceled')
    this.name = 'UploadCanceledError'
  }
}

export class DifferentFileError extends Error {
  constructor() {
    super('The selected file is not the one being uploaded')
    this.name = 'DifferentFileError'
  }
}

export class FileHashError extends Error {
  constructor() {
    super('The file could not be read')
    this.name = 'FileHashError'
  }
}

export function shareErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('shares.errors.invalid'),
    [NOT_FOUND]: t('shares.errors.notFound'),
    [CONFLICT]: t('shares.errors.slugTaken'),
  }
}

export function shareFileErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('shares.errors.fileInvalid'),
    [NOT_FOUND]: t('shares.errors.fileNotFound'),
    [CONFLICT]: t('shares.errors.fileConflict'),
    [PAYLOAD_TOO_LARGE]: t('shares.errors.fileTooLarge'),
    [SERVICE_UNAVAILABLE]: t('shares.errors.storageUnavailable'),
  }
}

export function uploadErrorMessage(error: unknown, t: TFunction): string {
  if (error instanceof DifferentFileError) {
    return t('shares.errors.differentFile')
  }
  if (error instanceof FileHashError) {
    return t('shares.errors.hashFailed')
  }
  return extractErrorMessage(error, t('shares.errors.uploadInterrupted'), shareFileErrorMessages(t))
}
