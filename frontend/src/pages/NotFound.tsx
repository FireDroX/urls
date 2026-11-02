import { useTranslation } from 'react-i18next'
import { StatusMessage } from '#components/StatusMessage'

export function NotFound() {
  const { t } = useTranslation()
  return <StatusMessage title={t('notFound.title')} body={t('notFound.body')} />
}
