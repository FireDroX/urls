import { useMemo } from 'react'
import { Copy, Ellipsis, Pencil, Power, PowerOff, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { dropDetailPath, dropUrl, type Drop } from '#api/drops'
import { DropStateBadge } from '#components/drops/DropStateBadge'
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

export interface DropActions {
  onCopy: (drop: Drop) => void
  onEdit: (drop: Drop) => void
  onToggle: (drop: Drop) => void
  onDelete: (drop: Drop) => void
}

interface DropRowProps {
  drop: Drop
  formatDate: (iso: string) => string
  actions: DropActions
}

function DropRow({ drop, formatDate, actions }: DropRowProps) {
  const { t } = useTranslation()
  const formatSize = useFileSize()

  return (
    <TableRow>
      <TableCell className="max-w-56 truncate">
        <RouterLink
          to={dropDetailPath(drop.id)}
          className="font-medium underline-offset-4 hover:underline"
          title={t('drops.open', { slug: drop.id })}
        >
          {drop.title ?? t('drops.untitled')}
        </RouterLink>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="font-mono">{dropUrl(drop.id)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('links.copy', { slug: drop.id })}
            onClick={() => actions.onCopy(drop)}
          >
            <Copy />
          </Button>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {t('drops.filesOfMax', { current: drop.fileCount, max: drop.maxFiles })}
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">
        {t('drops.sizeOfMax', { current: formatSize(drop.totalSize), max: formatSize(drop.maxTotalBytes) })}
      </TableCell>
      <TableCell>
        <DropStateBadge state={drop.state} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {drop.expiresAt ? formatDate(drop.expiresAt) : t('links.noExpiry')}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('links.actions', { slug: drop.id })}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.onCopy(drop)}>
              <Copy />
              {t('drops.copyAction')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onEdit(drop)}>
              <Pencil />
              {t('links.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onToggle(drop)}>
              {drop.disabled ? <Power /> : <PowerOff />}
              {drop.disabled ? t('links.enable') : t('links.disable')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(drop)}>
              <Trash />
              {t('links.delete.action')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function DropsTable({ drops, actions }: { drops: Drop[]; actions: DropActions }) {
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
            <TableHead>{t('drops.columns.title')}</TableHead>
            <TableHead>{t('links.columns.link')}</TableHead>
            <TableHead>{t('drops.columns.files')}</TableHead>
            <TableHead>{t('drops.columns.size')}</TableHead>
            <TableHead>{t('links.columns.state')}</TableHead>
            <TableHead>{t('links.columns.expiresAt')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drops.map((drop) => (
            <DropRow key={drop.id} drop={drop} formatDate={formatDate} actions={actions} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
