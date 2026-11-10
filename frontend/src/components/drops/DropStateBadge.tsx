import { useTranslation } from 'react-i18next'
import type { DropState } from '#api/drops'
import { Badge } from '#components/ui/badge'

const STATE_BADGE_VARIANTS = {
  open: 'default',
  full: 'outline',
  disabled: 'secondary',
  expired: 'destructive',
} as const satisfies Record<DropState, string>

export function DropStateBadge({ state }: { state: DropState }) {
  const { t } = useTranslation()

  return <Badge variant={STATE_BADGE_VARIANTS[state]}>{t(`drops.state.${state}`)}</Badge>
}
