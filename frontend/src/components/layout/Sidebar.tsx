import { ArrowRightLeft, Files, FolderUp, Inbox, LayoutDashboard, Settings, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { useBrokenLinksCount } from '#hooks/useBrokenLinksCount'
import { StorageMeter } from '#components/layout/StorageMeter'
import { cn } from '#lib/utils'

const NAV_ITEMS = [
  { to: '/', labelKey: 'layout.allLinks', icon: LayoutDashboard, end: true },
  { to: '/redirects', labelKey: 'layout.redirects', icon: ArrowRightLeft, end: false },
  { to: '/shares', labelKey: 'layout.shares', icon: FolderUp, end: false },
  { to: '/drops', labelKey: 'layout.drops', icon: Inbox, end: false },
  { to: '/files', labelKey: 'layout.files', icon: Files, end: false },
  { to: '/organization', labelKey: 'layout.organization', icon: Tags, end: false },
  { to: '/settings', labelKey: 'layout.settings', icon: Settings, end: true },
] as const

export function Sidebar() {
  const { t } = useTranslation()
  const brokenCount = useBrokenLinksCount()

  return (
    <nav
      aria-label={t('layout.navigation')}
      className="flex w-full flex-col gap-1 border-b border-sidebar-border bg-sidebar p-3 md:w-64 md:shrink-0 md:border-r md:border-b-0"
    >
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              isActive && 'bg-sidebar-accent text-sidebar-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {t(labelKey)}
          {to === '/redirects' && brokenCount !== null && brokenCount > 0 && (
            <span
              role="img"
              aria-label={t('layout.brokenRedirects', { count: brokenCount })}
              className="ml-auto rounded-full bg-destructive/10 px-1.5 text-xs font-semibold text-destructive tabular-nums"
            >
              {brokenCount}
            </span>
          )}
        </NavLink>
      ))}
      <div className="mt-auto hidden pt-4 md:block">
        <StorageMeter />
      </div>
    </nav>
  )
}
