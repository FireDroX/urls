import { useTranslation } from 'react-i18next'
import { StatusMessage } from '#components/StatusMessage'

export function NotFound({ footer }: { footer?: string }) {
  const { t } = useTranslation()
  return <StatusMessage title={t('notFound.title')} body={t('notFound.body')} footer={footer} />
}
