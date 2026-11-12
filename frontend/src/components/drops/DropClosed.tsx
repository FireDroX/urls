import { useTranslation } from 'react-i18next'
import { StatusMessage } from '#components/StatusMessage'

export function DropClosed() {
  const { t } = useTranslation()
  return <StatusMessage title={t('dropUpload.closed.title')} body={t('dropUpload.closed.body')} />
}
