import { ArrowRightLeft, FolderUp, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LinkType } from '#api/list-params'
import { Badge } from '#components/ui/badge'

const TYPE_ICONS = {
  redirect: ArrowRightLeft,
  share: FolderUp,
  drop: Inbox,
} as const satisfies Record<LinkType, unknown>

export function LinkTypeBadge({ type }: { type: LinkType }) {
  const { t } = useTranslation()
  const Icon = TYPE_ICONS[type]

  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {t(`linkTypes.${type}`)}
    </Badge>
  )
}
