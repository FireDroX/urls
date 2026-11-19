import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import type { AnyLink } from '#api/links'
import type { AllLinkState, LinkType } from '#api/list-params'
import { LinkTypeBadge } from '#components/dashboard/LinkTypeBadge'
import { LinkOrganizationSummary, type OrganizationSelection } from '#components/links/LinkOrganizationSummary'
import { Badge } from '#components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'

const DETAIL_PREFIXES = {
  redirect: '/redirects',
  share: '/shares',
  drop: '/drops',
} as const satisfies Record<LinkType, string>

const STATE_BADGE_VARIANTS = {
  active: 'default',
  full: 'outline',
  disabled: 'secondary',
  expired: 'destructive',
} as const satisfies Record<AllLinkState, string>

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
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('dashboard.columns.type')}</TableHead>
            <TableHead>{t('dashboard.columns.link')}</TableHead>
            <TableHead>{t('dashboard.columns.target')}</TableHead>
            <TableHead>{t('dashboard.columns.state')}</TableHead>
            <TableHead>{t('dashboard.columns.createdAt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => {
            const target = link.type === 'redirect' ? link.destination : link.title
            return (
              <TableRow key={`${link.type}:${link.id}`}>
                <TableCell>
                  <LinkTypeBadge type={link.type} />
                </TableCell>
                <TableCell>
                  <RouterLink
                    to={linkDetailTarget(link)}
                    className="font-mono text-primary underline-offset-4 hover:underline"
                  >
                    {link.id}
                  </RouterLink>
                  <LinkOrganizationSummary tags={link.tags} folder={link.folder} className="mt-1" {...selection} />
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="block truncate" title={target ?? undefined}>
                    {target}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={STATE_BADGE_VARIANTS[link.state]}>{t(`dashboard.state.${link.state}`)}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(link.createdAt)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
