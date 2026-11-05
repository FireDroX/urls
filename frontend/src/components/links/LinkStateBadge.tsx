import { useTranslation } from 'react-i18next'
import { Badge } from '#components/ui/badge'
import { linkState, type LinkState, type LinkStatus } from '#utils/link-state'

const STATE_BADGE_VARIANTS = {
  active: 'default',
  disabled: 'secondary',
  expired: 'destructive',
} as const satisfies Record<LinkState, string>

export function LinkStateBadge({ link }: { link: LinkStatus }) {
  const { t } = useTranslation()
  const state = linkState(link)

  return <Badge variant={STATE_BADGE_VARIANTS[state]}>{t(`links.state.${state}`)}</Badge>
}
