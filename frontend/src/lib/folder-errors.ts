import type { TFunction } from 'i18next'
import type { MessagesByStatus } from '#lib/api-errors'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409

export function folderErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('organization.folders.errors.invalid'),
    [NOT_FOUND]: t('organization.folders.errors.notFound'),
    [CONFLICT]: t('organization.folders.errors.nameTaken'),
  }
}
