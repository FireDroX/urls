import type { TFunction } from 'i18next'
import type { MessagesByStatus } from '#lib/api-errors'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409
const SERVICE_UNAVAILABLE = 503

export function fileListErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('files.errors.invalid'),
    [NOT_FOUND]: t('files.errors.notFound'),
    [SERVICE_UNAVAILABLE]: t('files.errors.storageUnavailable'),
  }
}

export function fileDeleteErrorMessages(t: TFunction): MessagesByStatus {
  return { ...fileListErrorMessages(t), [CONFLICT]: t('files.errors.inUse') }
}

export function fileDownloadErrorMessages(t: TFunction): MessagesByStatus {
  return { ...fileListErrorMessages(t), [CONFLICT]: t('files.errors.notReady') }
}
