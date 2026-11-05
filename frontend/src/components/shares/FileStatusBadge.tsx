import { useTranslation } from 'react-i18next'
import type { FileStatus } from '#api/shares'
import { Badge } from '#components/ui/badge'

const STATUS_BADGE_VARIANTS = {
  uploading: 'outline',
  verifying: 'secondary',
  ready: 'default',
  rejected: 'destructive',
} as const satisfies Record<FileStatus, string>

export function FileStatusBadge({ status }: { status: FileStatus }) {
  const { t } = useTranslation()

  return <Badge variant={STATUS_BADGE_VARIANTS[status]}>{t(`shares.fileStatus.${status}`)}</Badge>
}
