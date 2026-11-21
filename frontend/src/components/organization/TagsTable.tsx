import { Ellipsis, Pencil, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Tag } from '#api/tags'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'

export interface TagActions {
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
}

export function TagsTable({ tags, actions }: { tags: Tag[]; actions: TagActions }) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('organization.tags.columns.name')}</TableHead>
            <TableHead>{t('organization.columns.links')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tags.map((tag) => (
            <TableRow key={tag.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium">{tag.name}</span>
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{tag.linkCount}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t('organization.tags.actions', { name: tag.name })}>
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => actions.onEdit(tag)}>
                      <Pencil />
                      {t('links.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(tag)}>
                      <Trash />
                      {t('links.delete.action')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
