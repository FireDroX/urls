import { useState } from 'react'
import { Files as FilesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { createFileDownloadUrl, deleteFile, type StoredFile } from '#api/files'
import { FilesTable, type FileActions } from '#components/files/FilesTable'
import { FilesUsage } from '#components/files/FilesUsage'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useFileSize } from '#hooks/useFileSize'
import { useFiles, type FilesState } from '#hooks/useFiles'
import { extractErrorMessage } from '#lib/api-errors'
import { fileDeleteErrorMessages, fileDownloadErrorMessages } from '#lib/file-errors'
import { startDownload } from '#utils/start-download'

const SKELETON_ROWS = 3
const ORPHANS_PARAM = 'orphans'

interface FilesContentProps {
  state: FilesState
  orphansOnly: boolean
  actions: FileActions
  onRetry: () => void
}

function FilesContent({ state, orphansOnly, actions, onRetry }: FilesContentProps) {
  const { t } = useTranslation()

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <LinksPlaceholder
        icon={FilesIcon}
        title={t('files.loadFailedTitle')}
        body={state.message}
        action={
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }
  return (
    <>
      <FilesUsage summary={state.summary} />
      {state.files.length === 0 ? (
        <LinksPlaceholder
          icon={FilesIcon}
          title={orphansOnly ? t('files.emptyOrphansTitle') : t('files.emptyTitle')}
          body={orphansOnly ? t('files.emptyOrphansBody') : t('files.emptyBody')}
        />
      ) : (
        <FilesTable files={state.files} actions={actions} />
      )}
    </>
  )
}

export function Files() {
  const { t } = useTranslation()
  useDocumentTitle(t('files.title'))
  const formatSize = useFileSize()
  const [searchParams, setSearchParams] = useSearchParams()
  const orphansOnly = searchParams.get(ORPHANS_PARAM) === 'true'
  const { state, reload, refresh } = useFiles(orphansOnly)
  const [toDelete, setToDelete] = useState<StoredFile | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  function selectFilter(orphans: boolean) {
    setSearchParams(orphans ? { [ORPHANS_PARAM]: 'true' } : {}, { replace: true })
  }

  async function download(file: StoredFile) {
    setDownloadingId(file.publicId)
    try {
      startDownload(await createFileDownloadUrl(file.publicId))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, fileDownloadErrorMessages(t)))
    } finally {
      setDownloadingId(null)
    }
  }

  async function confirmDelete(file: StoredFile) {
    await deleteFile(file.publicId)
    toast.success(t('files.deleted'))
    setDeleteOpen(false)
    refresh()
  }

  const actions: FileActions = {
    onDownload: (file) => void download(file),
    onDelete: (file) => {
      setToDelete(file)
      setDeleteOpen(true)
    },
    downloadingId,
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">{t('files.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('files.subtitle')}</p>
        </div>
        <div role="group" aria-label={t('files.filter.label')} className="flex gap-2">
          <Button
            variant={orphansOnly ? 'outline' : 'default'}
            aria-pressed={!orphansOnly}
            onClick={() => selectFilter(false)}
          >
            {t('files.filter.all')}
          </Button>
          <Button
            variant={orphansOnly ? 'default' : 'outline'}
            aria-pressed={orphansOnly}
            onClick={() => selectFilter(true)}
          >
            {t('files.filter.orphans')}
          </Button>
        </div>
      </div>
      <FilesContent state={state} orphansOnly={orphansOnly} actions={actions} onRetry={reload} />
      {toDelete && (
        <ConfirmDeleteDialog
          open={deleteOpen}
          title={t('files.deleteTitle')}
          description={t('files.deleteDescription', { name: toDelete.name, size: formatSize(toDelete.size) })}
          onOpenChange={setDeleteOpen}
          onConfirm={() => confirmDelete(toDelete)}
          errorMessage={(error) => extractErrorMessage(error, undefined, fileDeleteErrorMessages(t))}
        />
      )}
    </>
  )
}
