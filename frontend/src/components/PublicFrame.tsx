import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LogoMark, Wordmark } from '#components/Logo'
import { cn } from '#lib/utils'

interface PublicFrameProps {
  footer: string
  children: ReactNode
  className?: string
}

export function PublicFrame({ footer, children, className }: PublicFrameProps) {
  return (
    <div data-density="public" className="flex min-h-svh flex-col items-center gap-7 bg-background px-4 py-12">
      <Link to="/" className="flex items-center gap-2 text-foreground no-underline">
        <LogoMark size={28} />
        <Wordmark />
      </Link>
      <main className={cn('w-full max-w-[560px] rounded-[14px] border border-border bg-card', className)}>
        {children}
      </main>
      <footer className="text-xs text-muted-foreground">{footer}</footer>
    </div>
  )
}
