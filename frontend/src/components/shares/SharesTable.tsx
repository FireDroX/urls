import { useMemo } from 'react'
import { Copy, Ellipsis, FolderOpen, Pencil, Power, PowerOff, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { shareDetailPath, sharePath, type Share } from '#api/shares'
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
import { useFileSize } from '#hooks/useFileSize'

export interface ShareActions {
  onCopy: (share: Share) => void
  onOpen: (share: Share) => void
  onEdit: (share: Share) => void
  onToggle: (share: Share) => void
  onDelete: (share: Share) => void
}

interface ShareRowProps {
  share: Share
  formatDate: (iso: string) => string
  actions: ShareActions
}

function ShareRow({ share, formatDate, actions }: ShareRowProps) {
  const { t } = useTranslation()
  const formatSize = useFileSize()

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1">
          <RouterLink
            to={shareDetailPath(share.id)}
            className="font-mono text-primary underline-offset-4 hover:underline"
            title={t('shares.open', { slug: share.id })}
          >
            {sharePath(share.id)}
          </RouterLink>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('links.copy', { slug: share.id })}
            onClick={() => actions.onCopy(share)}
          >
            <Copy />
          </Button>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {t('shares.fileSummary', { count: share.fileCount, size: formatSize(share.totalSize) })}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {share.maxDownloads === null
          ? share.downloadCount
          : t('shares.downloadsOfMax', { current: share.downloadCount, max: share.maxDownloads })}
      </TableCell>
      <TableCell>
        <LinkStateBadge link={share} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {share.expiresAt ? formatDate(share.expiresAt) : t('links.noExpiry')}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('links.actions', { slug: share.id })}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.onOpen(share)}>
              <FolderOpen />
              {t('shares.files.title')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit(share)}>
              <Pencil />
              {t('links.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onToggle(share)}>
              {share.disabled ? <Power /> : <PowerOff />}
              {share.disabled ? t('links.enable') : t('links.disable')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(share)}>
              <Trash />
              {t('links.delete.action')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function SharesTable({ shares, actions }: { shares: Share[]; actions: ShareActions }) {
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
            <TableHead>{t('shares.columns.files')}</TableHead>
            <TableHead>{t('shares.columns.downloads')}</TableHead>
            <TableHead>{t('links.columns.state')}</TableHead>
            <TableHead>{t('links.columns.expiresAt')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shares.map((share) => (
            <ShareRow key={share.id} share={share} formatDate={formatDate} actions={actions} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
