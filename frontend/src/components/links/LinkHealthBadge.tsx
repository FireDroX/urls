import { useTranslation } from 'react-i18next'
import type { LinkLastCheck } from '#api/links'
import { Badge } from '#components/ui/badge'
import { useLastCheckDetails } from '#hooks/useLastCheckDetails'
import { linkHealth } from '#utils/link-health'

export function LinkHealthBadge({ lastCheck }: { lastCheck: LinkLastCheck | null }) {
  const { t } = useTranslation()
  const details = useLastCheckDetails(lastCheck)
  const health = linkHealth(lastCheck)

  if (health === 'ok') return null
  return (
    <span title={details.summary}>
      <Badge variant={health === 'broken' ? 'destructive' : 'outline'}>{t(`links.health.${health}`)}</Badge>
    </span>
  )
}
