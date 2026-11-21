import { Ellipsis, Pencil, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Folder } from '#api/folders'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'

export interface FolderActions {
  onEdit: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}

export function FoldersTable({ folders, actions }: { folders: Folder[]; actions: FolderActions }) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('organization.folders.columns.name')}</TableHead>
            <TableHead>{t('organization.columns.links')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => (
            <TableRow key={folder.id}>
              <TableCell className="font-medium">{folder.name}</TableCell>
              <TableCell className="tabular-nums">{folder.linkCount}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('organization.folders.actions', { name: folder.name })}
                    >
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => actions.onEdit(folder)}>
                      <Pencil />
                      {t('links.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => actions.onDelete(folder)}>
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
