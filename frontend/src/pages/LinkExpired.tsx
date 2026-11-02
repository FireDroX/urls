import { useTranslation } from 'react-i18next'
import { StatusMessage } from '#components/StatusMessage'

export function LinkExpired() {
  const { t } = useTranslation()
  return <StatusMessage title={t('linkExpired.title')} body={t('linkExpired.body')} />
}
