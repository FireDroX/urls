import type { ComponentProps } from 'react'
import { Badge } from '#components/ui/badge'
import { cn } from '#lib/utils'

export type StatusTone = 'success' | 'danger' | 'expired' | 'neutral' | 'outline'

const TONE_CLASSES = {
  success: 'border-transparent bg-state-success-bg text-state-success',
  danger: 'border-transparent bg-state-danger-bg text-state-danger',
  expired: 'border-transparent bg-state-expired-bg text-state-expired',
  neutral: 'border-transparent bg-state-neutral-bg text-state-neutral',
  outline: 'border-badge-border bg-transparent text-foreground',
} as const satisfies Record<StatusTone, string>

interface StatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'variant'> {
  tone: StatusTone
}

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      className={cn('h-auto rounded-full border px-2 py-0.5 text-xs font-semibold', TONE_CLASSES[tone], className)}
      {...props}
    />
  )
}
