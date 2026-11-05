import { useRef, type ChangeEvent } from 'react'
import { RotateCw, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ShareFile } from '#api/shares'
import { FileStatusBadge } from '#components/shares/FileStatusBadge'
import { Button } from '#components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { useFileSize } from '#hooks/useFileSize'

export interface ShareFileActions {
  onResume: (file: ShareFile, selected: File) => void
  onDelete: (file: ShareFile) => void
}

function ResumeButton({ file, onResume }: { file: ShareFile; onResume: ShareFileActions['onResume'] }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (selected) onResume(file, selected)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={t('shares.files.resumeInput', { name: file.name })}
        onChange={handleChange}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <RotateCw />
        {t('shares.files.resume')}
      </Button>
    </>
  )
}

function ShareFileRow({ file, actions }: { file: ShareFile; actions: ShareFileActions }) {
  const { t } = useTranslation()
  const formatSize = useFileSize()

  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <span className="block truncate font-medium" title={file.name}>
          {file.name}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{formatSize(file.size)}</TableCell>
      <TableCell>
        <FileStatusBadge status={file.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {file.status === 'uploading' && <ResumeButton file={file} onResume={actions.onResume} />}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('shares.files.delete', { name: file.name })}
            onClick={() => actions.onDelete(file)}
          >
            <Trash />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function ShareFilesTable({ files, actions }: { files: ShareFile[]; actions: ShareFileActions }) {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('shares.files.name')}</TableHead>
            <TableHead>{t('shares.files.size')}</TableHead>
            <TableHead>{t('shares.files.status')}</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">{t('links.columns.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <ShareFileRow key={file.id} file={file} actions={actions} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
