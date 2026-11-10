import type { TFunction } from 'i18next'
import type { MessagesByStatus } from '#lib/api-errors'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409

export function dropErrorMessages(t: TFunction): MessagesByStatus {
  return {
    [BAD_REQUEST]: t('drops.errors.invalid'),
    [NOT_FOUND]: t('drops.errors.notFound'),
    [CONFLICT]: t('drops.errors.slugTaken'),
  }
}
