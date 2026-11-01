import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'

const LOGO_WIDTH = 72
const LOGO_HEIGHT = 80
const MASCOT_WIDTH = 600
const MASCOT_HEIGHT = 761

export function LogoMark({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/logo-light.svg"
        alt=""
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn('h-8 w-auto dark:hidden', className)}
      />
      <img
        src="/logo-dark.svg"
        alt=""
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={cn('hidden h-8 w-auto dark:block', className)}
      />
    </>
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
    <span className="font-heading text-lg font-bold tracking-tight">
      url<span className="font-medium text-muted-foreground">.addrien</span>
    </span>
  )
}
