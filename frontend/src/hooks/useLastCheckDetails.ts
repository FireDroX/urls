import { useTranslation } from 'react-i18next'
import type { LinkLastCheck } from '#api/links'
import { formatRelativeTime } from '#utils/relative-time'

export interface LastCheckDetails {
  result: string
  code: string
  relativeDate: string | null
  fullDate: string | null
  summary: string
}

export function useLastCheckDetails(lastCheck: LinkLastCheck | null): LastCheckDetails {
  const { t, i18n } = useTranslation()

  if (!lastCheck) {
    const result = t('links.health.neverChecked')
    return { result, code: t('links.health.noCode'), relativeDate: null, fullDate: null, summary: result }
  }
  const result = t(`links.health.outcomes.${lastCheck.outcome}`)
  const code =
    lastCheck.statusCode !== null
      ? t('links.health.httpStatus', { code: lastCheck.statusCode })
      : lastCheck.errorKind
        ? t(`links.health.errorKinds.${lastCheck.errorKind}`)
        : t('links.health.noCode')
  const checkedAt = new Date(lastCheck.checkedAt)
  const relativeDate = formatRelativeTime(checkedAt, new Date(), i18n.language)
  const fullDate = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(checkedAt)
  const summary = [result, lastCheck.statusCode !== null || lastCheck.errorKind ? code : null, fullDate]
    .filter(Boolean)
    .join(' · ')
  return { result, code, relativeDate, fullDate, summary }
}
