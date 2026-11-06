import { Download, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { StoredFile } from '#api/files'
import { FileOrigin } from '#components/files/FileOrigin'
import { FileStatusBadge } from '#components/shares/FileStatusBadge'
import { Button } from '#components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { useFileSize } from '#hooks/useFileSize'

export interface FileActions {
  onDownload: (file: StoredFile) => void
  onDelete: (file: StoredFile) => void
  downloadingId: string | null
}

function FileRow({ file, actions }: { file: StoredFile; actions: FileActions }) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()
  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const deleteLabel = t('files.delete', { name: file.name })

  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <span className="block truncate font-medium" title={file.name}>
          {file.name}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{formatSize(file.size)}</TableCell>
      <TableCell className="text-muted-foreground">{file.mime ?? '—'}</TableCell>
      <TableCell>
        <FileStatusBadge status={file.status} />
      </TableCell>
      <TableCell>
        <FileOrigin link={file.link} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatter.format(new Date(file.createdAt))}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {file.status === 'ready' && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('files.download', { name: file.name })}
              disabled={actions.downloadingId === file.publicId}
              onClick={() => actions.onDownload(file)}
            >
              <Download />
            </Button>
          )}
          {file.inUse ? (
            <span title={t('files.inUseHint')} tabIndex={0}>
              <Button variant="ghost" size="icon-sm" aria-label={deleteLabel} disabled>
                <Trash />
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="icon-sm" aria-label={deleteLabel} onClick={() => actions.onDelete(file)}>
              <Trash />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function FilesTable({ files, actions }: { files: StoredFile[]; actions: FileActions }) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('files.columns.name')}</TableHead>
            <TableHead>{t('files.columns.size')}</TableHead>
            <TableHead>{t('files.columns.mime')}</TableHead>
            <TableHead>{t('files.columns.status')}</TableHead>
            <TableHead>{t('files.columns.origin')}</TableHead>
            <TableHead>{t('files.columns.date')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <FileRow key={file.publicId} file={file} actions={actions} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
