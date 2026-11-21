import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import type { AnyLink } from '#api/links'
import type { AllLinkState, LinkType } from '#api/list-params'
import { LinkTypeBadge } from '#components/dashboard/LinkTypeBadge'
import { LinkOrganizationSummary, type OrganizationSelection } from '#components/links/LinkOrganizationSummary'
import { StatusBadge, type StatusTone } from '#components/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { cn } from '#lib/utils'

const DETAIL_PREFIXES = {
  redirect: '/redirects',
  share: '/shares',
  drop: '/drops',
} as const satisfies Record<LinkType, string>

const STATE_TONES = {
  active: 'success',
  full: 'expired',
  disabled: 'neutral',
  expired: 'expired',
} as const satisfies Record<AllLinkState, StatusTone>

const HEAD_CLASS = 'h-auto px-3 py-2.5 text-xs font-semibold text-muted-foreground'
const CELL_CLASS = 'p-3 text-sm'

export function linkDetailTarget(link: Pick<AnyLink, 'type' | 'id'>): string {
  return `${DETAIL_PREFIXES[link.type]}/${encodeURIComponent(link.id)}`
}

interface AllLinksTableProps {
  links: AnyLink[]
  selection: OrganizationSelection
}

export function AllLinksTable({ links, selection }: AllLinksTableProps) {
  const { t, i18n } = useTranslation()
  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    return (iso: string) => formatter.format(new Date(iso))
  }, [i18n.language])

  return (
    <div className="rounded-[10px] border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className={HEAD_CLASS}>{t('dashboard.columns.type')}</TableHead>
            <TableHead className={HEAD_CLASS}>{t('dashboard.columns.link')}</TableHead>
            <TableHead className={HEAD_CLASS}>{t('dashboard.columns.target')}</TableHead>
            <TableHead className={HEAD_CLASS}>{t('dashboard.columns.state')}</TableHead>
            <TableHead className={HEAD_CLASS}>{t('dashboard.columns.createdAt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => {
            const target = link.type === 'redirect' ? link.destination : link.title
            const muted = link.state === 'disabled' || link.state === 'expired'
            return (
              <TableRow key={`${link.type}:${link.id}`} className="border-table-divider">
                <TableCell className={CELL_CLASS}>
                  <LinkTypeBadge type={link.type} />
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  <RouterLink
                    to={linkDetailTarget(link)}
                    className={cn(
                      'font-mono text-[13px] underline-offset-4 hover:underline',
                      muted ? 'text-muted-foreground' : 'text-link-accent',
                    )}
                  >
                    {link.id}
                  </RouterLink>
                  <LinkOrganizationSummary tags={link.tags} folder={link.folder} className="mt-1" {...selection} />
                </TableCell>
                <TableCell className={cn(CELL_CLASS, 'max-w-xs', muted && 'text-muted-foreground')}>
                  <span className="block truncate" title={target ?? undefined}>
                    {target}
                  </span>
                </TableCell>
                <TableCell className={CELL_CLASS}>
                  <StatusBadge tone={STATE_TONES[link.state]}>{t(`dashboard.state.${link.state}`)}</StatusBadge>
                </TableCell>
                <TableCell className={cn(CELL_CLASS, 'whitespace-nowrap text-muted-foreground')}>
                  {formatDate(link.createdAt)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
