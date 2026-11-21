import { useTranslation } from 'react-i18next'
import type { LinkLastCheck } from '#api/links'
import { StatusBadge } from '#components/StatusBadge'
import { useLastCheckDetails } from '#hooks/useLastCheckDetails'
import { linkHealth } from '#utils/link-health'

export function LinkHealthBadge({ lastCheck }: { lastCheck: LinkLastCheck | null }) {
  const { t } = useTranslation()
  const details = useLastCheckDetails(lastCheck)
  const health = linkHealth(lastCheck)

  if (health === 'ok') return null
  return (
    <span title={details.summary}>
      <StatusBadge tone={health === 'broken' ? 'danger' : 'outline'}>{t(`links.health.${health}`)}</StatusBadge>
    </span>
  )
}
