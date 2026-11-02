import { useMemo } from 'react'
import { ChartColumn, Copy, Ellipsis, Pencil, Power, PowerOff, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { redirectPath } from '#api/redirects'
import type { Link } from '#api/links'
import { LinkStateBadge } from '#components/links/LinkStateBadge'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { linkDetailPath } from '#utils/link-stats'

export interface LinkActions {
  onCopy: (link: Link) => void
  onStats: (link: Link) => void
  onEdit: (link: Link) => void
  onToggle: (link: Link) => void
  onDelete: (link: Link) => void
}

interface LinkRowProps {
  link: Link
  formatDate: (iso: string) => string
  actions: LinkActions
}

function LinkRow({ link, formatDate, actions }: LinkRowProps) {
  const { t } = useTranslation()

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1">
          <RouterLink
            to={linkDetailPath(link.id)}
            className="font-mono text-primary underline-offset-4 hover:underline"
            title={t('links.viewStats', { slug: link.id })}
          >
            {redirectPath(link.id)}
          </RouterLink>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('links.copy', { slug: link.id })}
            onClick={() => actions.onCopy(link)}
          >
            <Copy />
          </Button>
        </div>
      </TableCell>
      <TableCell className="max-w-xs">
        <span className="block truncate" title={link.destination ?? undefined}>
          {link.destination}
        </span>
      </TableCell>
      <TableCell>
        <LinkStateBadge link={link} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {link.expiresAt ? formatDate(link.expiresAt) : t('links.noExpiry')}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('links.actions', { slug: link.id })}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.onStats(link)}>
              <ChartColumn />
              {t('links.stats')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit(link)}>
              <Pencil />
              {t('links.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onToggle(link)}>
              {link.disabled ? <Power /> : <PowerOff />}
              {link.disabled ? t('links.enable') : t('links.disable')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(link)}>
              <Trash />
              {t('links.delete.action')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function LinksTable({ links, actions }: { links: Link[]; actions: LinkActions }) {
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
            <TableHead>{t('links.columns.link')}</TableHead>
            <TableHead>{t('links.columns.destination')}</TableHead>
            <TableHead>{t('links.columns.state')}</TableHead>
            <TableHead>{t('links.columns.expiresAt')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {links.map((link) => (
            <LinkRow key={link.id} link={link} formatDate={formatDate} actions={actions} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
