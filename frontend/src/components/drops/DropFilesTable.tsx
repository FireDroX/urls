import { useMemo } from 'react'
import { Download, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DropFile } from '#api/drops'
import { FileStatusBadge } from '#components/shares/FileStatusBadge'
import { Button } from '#components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { useFileSize } from '#hooks/useFileSize'

export interface DropFileActions {
  onDownload: (file: DropFile) => void
  onDelete: (file: DropFile) => void
}

interface DropFilesTableProps {
  files: DropFile[]
  actions: DropFileActions
}

export function DropFilesTable({ files, actions }: DropFilesTableProps) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()
  const formatDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    return (iso: string) => formatter.format(new Date(iso))
  }, [i18n.language])

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('drops.files.name')}</TableHead>
            <TableHead>{t('drops.files.uploader')}</TableHead>
            <TableHead>{t('drops.files.size')}</TableHead>
            <TableHead>{t('drops.files.status')}</TableHead>
            <TableHead>{t('drops.files.receivedAt')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="max-w-xs">
                <span className="block truncate font-medium" title={file.name}>
                  {file.name}
                </span>
              </TableCell>
              <TableCell className="max-w-40 truncate">
                {file.uploaderName ?? <span className="text-muted-foreground">{t('drops.files.anonymous')}</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatSize(file.size)}</TableCell>
              <TableCell>
                <FileStatusBadge status={file.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(file.createdAt)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={file.status !== 'ready'}
                    aria-label={t('drops.files.download', { name: file.name })}
                    onClick={() => actions.onDownload(file)}
                  >
                    <Download />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('drops.files.delete', { name: file.name })}
                    onClick={() => actions.onDelete(file)}
                  >
                    <Trash />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
