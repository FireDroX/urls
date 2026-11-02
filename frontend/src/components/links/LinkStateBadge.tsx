import { useTranslation } from 'react-i18next'
import type { Link } from '#api/links'
import { Badge } from '#components/ui/badge'
import { linkState, type LinkState } from '#utils/link-state'

const STATE_BADGE_VARIANTS = {
  active: 'default',
  disabled: 'secondary',
  expired: 'destructive',
} as const satisfies Record<LinkState, string>

export function LinkStateBadge({ link }: { link: Link }) {
  const { t } = useTranslation()
  const state = linkState(link)

  return <Badge variant={STATE_BADGE_VARIANTS[state]}>{t(`links.state.${state}`)}</Badge>
}
