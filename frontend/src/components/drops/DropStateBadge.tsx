import { useTranslation } from 'react-i18next'
import type { DropState } from '#api/drops'
import { StatusBadge, type StatusTone } from '#components/StatusBadge'

const STATE_TONES = {
  open: 'success',
  full: 'expired',
  disabled: 'neutral',
  expired: 'expired',
} as const satisfies Record<DropState, StatusTone>

export function DropStateBadge({ state }: { state: DropState }) {
  const { t } = useTranslation()

  return <StatusBadge tone={STATE_TONES[state]}>{t(`drops.state.${state}`)}</StatusBadge>
}
