import type { ReactNode } from 'react'
import { ArrowRightLeft, type LucideIcon } from 'lucide-react'

interface LinksPlaceholderProps {
  title: string
  body: string
  action?: ReactNode
  icon?: LucideIcon
}

export function LinksPlaceholder({ title, body, action, icon: Icon = ArrowRightLeft }: LinksPlaceholderProps) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action}
    </section>
  )
}
