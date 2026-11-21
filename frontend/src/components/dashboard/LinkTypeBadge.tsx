import { ArrowRightLeft, FolderUp, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LinkType } from '#api/list-params'
import { StatusBadge } from '#components/StatusBadge'

const TYPE_ICONS = {
  redirect: ArrowRightLeft,
  share: FolderUp,
  drop: Inbox,
} as const satisfies Record<LinkType, unknown>

export function LinkTypeBadge({ type }: { type: LinkType }) {
  const { t } = useTranslation()
  const Icon = TYPE_ICONS[type]

  return (
    <StatusBadge tone="outline">
      <Icon aria-hidden="true" />
      {t(`linkTypes.${type}`)}
    </StatusBadge>
  )
}
