import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'

const MASCOT_WIDTH = 600
const MASCOT_HEIGHT = 761
const DEFAULT_MARK_SIZE = 28

export function LogoMark({ size = DEFAULT_MARK_SIZE, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <g className="fill-foreground">
        <rect x="4" y="4" width="7" height="32" />
        <rect x="4" y="4" width="26" height="7" />
        <rect x="4" y="29" width="26" height="7" />
      </g>
      <rect x="16" y="17" width="14" height="6" fill="#ec3013" />
    </svg>
  )
}

export function Mascot({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <>
      <img
        src="/mascot-light.png"
        alt={t('common.mascotAlt')}
        width={MASCOT_WIDTH}
        height={MASCOT_HEIGHT}
        className={cn('w-auto dark:hidden', className)}
      />
      <img
        src="/mascot-dark.png"
        alt={t('common.mascotAlt')}
        width={MASCOT_WIDTH}
        height={MASCOT_HEIGHT}
        className={cn('hidden w-auto dark:block', className)}
      />
    </>
  )
}

export function Wordmark() {
  return (
    <span className="font-heading text-lg font-bold tracking-[-0.01em]">
      url<span className="font-medium text-muted-foreground">.addrien</span>
    </span>
  )
}
