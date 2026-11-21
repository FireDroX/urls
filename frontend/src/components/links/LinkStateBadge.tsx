import { useTranslation } from 'react-i18next'
import { StatusBadge, type StatusTone } from '#components/StatusBadge'
import { linkState, type LinkState, type LinkStatus } from '#utils/link-state'

const STATE_TONES = {
  active: 'success',
  disabled: 'neutral',
  expired: 'expired',
} as const satisfies Record<LinkState, StatusTone>

export function LinkStateBadge({ link }: { link: LinkStatus }) {
  const { t } = useTranslation()
  const state = linkState(link)

  return <StatusBadge tone={STATE_TONES[state]}>{t(`links.state.${state}`)}</StatusBadge>
}
