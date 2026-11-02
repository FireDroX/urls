import { ArrowRightLeft, LayoutDashboard, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { StorageMeter } from '#components/layout/StorageMeter'
import { cn } from '#lib/utils'

const NAV_ITEMS = [
  { to: '/', labelKey: 'layout.allLinks', icon: LayoutDashboard },
  { to: '/redirects', labelKey: 'layout.redirects', icon: ArrowRightLeft },
  { to: '/settings', labelKey: 'layout.settings', icon: Settings },
] as const

export function Sidebar() {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t('layout.navigation')}
      className="flex w-full flex-col gap-1 border-b border-sidebar-border bg-sidebar p-3 md:w-64 md:shrink-0 md:border-r md:border-b-0"
    >
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              isActive && 'bg-sidebar-accent text-sidebar-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {t(labelKey)}
        </NavLink>
      ))}
      <div className="mt-auto hidden pt-4 md:block">
        <StorageMeter />
      </div>
    </nav>
  )
}
