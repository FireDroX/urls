import type { LucideIcon } from 'lucide-react'

export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-state-expired-bg text-link-accent">
      <Icon className="size-6" aria-hidden="true" />
    </span>
  )
}
