import { useEffect, useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowRightLeft, FileWarning, Files, Folder, FolderUp, Inbox, LayoutDashboard, Plus, Settings, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, matchPath, useLocation, useNavigate } from 'react-router'
import { TagPill } from '#components/links/TagPill'
import { StorageMeter } from '#components/layout/StorageMeter'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { useBrokenLinksCount } from '#hooks/useBrokenLinksCount'
import { CREATE_REQUEST_STATE } from '#hooks/useCreateRequest'
import { useLinkOrganizationOptions, type LinkOrganizationOptions } from '#hooks/useLinkOrganizationOptions'
import { cn } from '#lib/utils'

const NAV_ITEM_CLASS =
  'flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-sm font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground'
const ACTIVE_CLASS = 'bg-sidebar-accent text-sidebar-foreground'
const SECTION_HEADING_CLASS =
  'mx-2.5 mt-4 mb-1.5 text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase'

const BROKEN_PATH = '/redirects'

const CREATE_ITEMS = [
  { to: '/redirects', labelKey: 'layout.newRedirect' },
  { to: '/shares', labelKey: 'layout.newShare' },
  { to: '/drops', labelKey: 'layout.newDrop' },
] as const

interface NavItem {
  to: string
  labelKey: string
  icon: LucideIcon
  end: boolean
  hint?: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'layout.allLinks', icon: LayoutDashboard, end: true },
  { to: '/redirects', labelKey: 'layout.redirects', icon: ArrowRightLeft, end: false, hint: '/r/' },
  { to: '/shares', labelKey: 'layout.shares', icon: FolderUp, end: false, hint: '/d/' },
  { to: '/drops', labelKey: 'layout.drops', icon: Inbox, end: false, hint: '/u/' },
]

const FOOTER_ITEMS: NavItem[] = [
  { to: '/files', labelKey: 'layout.files', icon: Files, end: false },
  { to: '/organization', labelKey: 'layout.organization', icon: Tags, end: false },
  { to: '/settings', labelKey: 'layout.settings', icon: Settings, end: true },
]

function CreateMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="mb-3 w-full">
          <Plus />
          {t('layout.new')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {CREATE_ITEMS.map(({ to, labelKey }) => (
          <DropdownMenuItem key={to} onSelect={() => void navigate(to, { state: CREATE_REQUEST_STATE })}>
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface NavEntryProps {
  to: string
  active: boolean
  icon: LucideIcon
  label: string
  hint?: string
  children?: ReactNode
}

function NavEntry({ to, active, icon: Icon, label, hint, children }: NavEntryProps) {
  return (
    <RouterLink
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(NAV_ITEM_CLASS, active && ACTIVE_CLASS)}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
      {hint && (
        <span aria-hidden="true" className="ml-auto text-xs text-muted-foreground">
          {hint}
        </span>
      )}
      {children}
    </RouterLink>
  )
}

function BrokenCount({ count }: { count: number }) {
  const { t } = useTranslation()

  return (
    <span
      role="img"
      aria-label={t('layout.brokenRedirects', { count })}
      className="ml-auto rounded-full bg-state-danger-bg px-2 py-0.5 text-xs font-semibold text-state-danger tabular-nums"
    >
      {count}
    </span>
  )
}

function OrganizationSections() {
  const { t } = useTranslation()
  const location = useLocation()
  const { options, reload } = useLinkOrganizationOptions()
  const lastReady = useRef<LinkOrganizationOptions | null>(null)

  const loadedPath = useRef(location.pathname)

  useEffect(() => {
    if (loadedPath.current === location.pathname) return
    loadedPath.current = location.pathname
    reload()
  }, [location.pathname, reload])

  if (options.status === 'ready') lastReady.current = options
  const visible = options.status === 'error' ? null : lastReady.current
  if (!visible) return null
  return (
    <>
      {visible.folders.length > 0 && (
        <>
          <div className={SECTION_HEADING_CLASS}>{t('layout.folders')}</div>
          {visible.folders.map((folder) => (
            <RouterLink key={folder.id} to={`/?folder=${encodeURIComponent(folder.id)}`} className={NAV_ITEM_CLASS}>
              <Folder className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{folder.name}</span>
            </RouterLink>
          ))}
        </>
      )}
      {visible.tags.length > 0 && (
        <>
          <div className={SECTION_HEADING_CLASS}>{t('layout.tags')}</div>
          <div className="flex flex-wrap gap-1.5 px-2.5">
            {visible.tags.map((tag) => (
              <RouterLink key={tag.id} to={`/?tag=${encodeURIComponent(tag.id)}`} className="rounded-full">
                <TagPill tag={tag} />
              </RouterLink>
            ))}
          </div>
        </>
      )}
    </>
  )
}

export function Sidebar() {
  const { t } = useTranslation()
  const brokenCount = useBrokenLinksCount()
  const { pathname, search } = useLocation()
  const brokenActive = pathname === BROKEN_PATH && new URLSearchParams(search).get('health') === 'broken'
  const isActive = (to: string, end: boolean) => matchPath({ path: to, end }, pathname) !== null

  return (
    <nav
      aria-label={t('layout.navigation')}
      className="flex w-full flex-col gap-1 border-b border-sidebar-border bg-sidebar p-3 md:w-[260px] md:shrink-0 md:border-r md:border-b-0"
    >
      <CreateMenu />
      {NAV_ITEMS.map(({ to, labelKey, icon, end, hint }) => (
        <NavEntry
          key={to}
          to={to}
          icon={icon}
          label={t(labelKey)}
          hint={hint}
          active={isActive(to, end) && !(to === BROKEN_PATH && brokenActive)}
        />
      ))}
      <NavEntry
        to={`${BROKEN_PATH}?health=broken`}
        icon={FileWarning}
        label={t('layout.brokenLinks')}
        active={brokenActive}
      >
        {brokenCount !== null && brokenCount > 0 && <BrokenCount count={brokenCount} />}
      </NavEntry>
      <OrganizationSections />
      <div className="mt-4 flex flex-col gap-1">
        {FOOTER_ITEMS.map(({ to, labelKey, icon, end }) => (
          <NavEntry key={to} to={to} icon={icon} label={t(labelKey)} active={isActive(to, end)} />
        ))}
      </div>
      <div className="mt-auto hidden pt-4 md:block">
        <StorageMeter />
      </div>
    </nav>
  )
}
