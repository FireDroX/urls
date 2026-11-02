import type { TFunction } from 'i18next'
import type { MessagesByStatus } from '#lib/api-errors'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409

export function linkErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('links.errors.invalid'),
    [NOT_FOUND]: t('links.errors.notFound'),
    [CONFLICT]: t('links.errors.slugTaken'),
  }
}
