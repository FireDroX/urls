import { useTranslation } from 'react-i18next'
import type { FileStatus } from '#api/shares'
import { StatusBadge, type StatusTone } from '#components/StatusBadge'

const STATUS_TONES = {
  uploading: 'outline',
  verifying: 'outline',
  ready: 'success',
  rejected: 'danger',
} as const satisfies Record<FileStatus, StatusTone>

export function FileStatusBadge({ status }: { status: FileStatus }) {
  const { t } = useTranslation()

  return <StatusBadge tone={STATUS_TONES[status]}>{t(`shares.fileStatus.${status}`)}</StatusBadge>
}
