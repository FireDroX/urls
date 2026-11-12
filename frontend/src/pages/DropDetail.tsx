import { useMemo, useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { ArrowLeft, Copy, Inbox, Pencil, Power, PowerOff, SearchX, Share2, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  deleteDrop,
  deleteDropFile,
  dropDetailPath,
  dropPath,
  dropUrl,
  updateDrop,
  type Drop,
  type DropDetail as DropDetailData,
  type DropFile,
} from '#api/drops'
import { createFileDownloadUrl } from '#api/files'
import { shareDetailPath } from '#api/shares'
import { DropFilesTable } from '#components/drops/DropFilesTable'
import { DropFormDialog } from '#components/drops/DropFormDialog'
import { DropStateBadge } from '#components/drops/DropStateBadge'
import { ShareDropFilesDialog } from '#components/drops/ShareDropFilesDialog'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useDropDetail } from '#hooks/useDropDetail'
import { useFileSize } from '#hooks/useFileSize'
import { extractErrorMessage } from '#lib/api-errors'
import { dropErrorMessages, dropFileDeleteErrorMessages } from '#lib/drop-errors'
import { fileDownloadErrorMessages } from '#lib/file-errors'
import { refreshStorageUsage } from '#lib/storage-usage-refresh'
import { startDownload } from '#utils/start-download'

const DROPS_LIST_PATH = '/drops'
const NOT_FOUND = 404

type DialogState = { kind: 'closed' } | { kind: 'share' } | { kind: 'edit' } | { kind: 'delete' } | { kind: 'deleteFile'; file: DropFile }

function BackLink() {
  const { t } = useTranslation()

  return (
    <RouterLink
      to={DROPS_LIST_PATH}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('drops.backToList')}
    </RouterLink>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  )
}

function DropStats({ drop }: { drop: DropDetailData }) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()
  const expiry = useMemo(() => {
    if (!drop.expiresAt) return t('links.noExpiry')
    const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    return formatter.format(new Date(drop.expiresAt))
  }, [drop.expiresAt, i18n.language, t])

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={t('drops.detail.views')}>{drop.viewCount}</Stat>
      <Stat label={t('drops.detail.files')}>
        {t('drops.filesOfMax', { current: drop.fileCount, max: drop.maxFiles })}
      </Stat>
      <Stat label={t('drops.detail.size')}>
        {t('drops.sizeOfMax', { current: formatSize(drop.totalSize), max: formatSize(drop.maxTotalBytes) })}
      </Stat>
      <Stat label={t('links.columns.expiresAt')}>{expiry}</Stat>
    </dl>
  )
}

interface DropHeaderProps {
  drop: DropDetailData
  onShare: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}

function DropDetailHeader({ drop, onShare, onEdit, onToggle, onDelete }: DropHeaderProps) {
  const { t } = useTranslation()
  const copyLink = useCopyLink(dropUrl)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-bold">{drop.title ?? t('drops.untitled')}</h1>
          <DropStateBadge state={drop.state} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!drop.files.some((file) => file.status === 'ready')} onClick={onShare}>
            <Share2 />
            {t('drops.share.action')}
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil />
            {t('links.edit')}
          </Button>
          <Button variant="outline" onClick={onToggle}>
            {drop.disabled ? <Power /> : <PowerOff />}
            {drop.disabled ? t('links.enable') : t('links.disable')}
          </Button>
          <Button variant="outline" onClick={onDelete}>
            <Trash />
            {t('links.delete.action')}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-mono text-primary">{dropUrl(drop.id)}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('links.copy', { slug: drop.id })}
          onClick={() => void copyLink(drop.id)}
        >
          <Copy />
        </Button>
      </div>
    </div>
  )
}

interface DropViewProps {
  drop: DropDetailData
  onChanged: (drop: DropDetailData) => void
  onRefresh: () => void
}

function DropView({ drop, onChanged, onRefresh }: DropViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' })

  function closeDialog() {
    setDialog({ kind: 'closed' })
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleSaved(saved: Drop) {
    closeDialog()
    onChanged({ ...drop, ...saved })
    toast.success(t('drops.updated'))
    if (saved.id !== drop.id) {
      void navigate(dropDetailPath(saved.id), { replace: true })
    }
  }

  async function toggleDrop() {
    try {
      const saved = await updateDrop(drop.id, { disabled: !drop.disabled })
      onChanged({ ...drop, ...saved })
      toast.success(saved.disabled ? t('drops.disabledToast') : t('drops.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, dropErrorMessages(t)))
    }
  }

  async function confirmDeleteDrop() {
    await deleteDrop(drop.id)
    toast.success(t('drops.deleted'))
    void navigate(DROPS_LIST_PATH, { replace: true })
  }

  async function download(file: DropFile) {
    try {
      startDownload(await createFileDownloadUrl(file.id))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, fileDownloadErrorMessages(t)))
    }
  }

  async function confirmDeleteFile(file: DropFile) {
    try {
      await deleteDropFile(drop.id, file.id)
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === NOT_FOUND) onRefresh()
      throw error
    }
    onChanged({
      ...drop,
      files: drop.files.filter((item) => item.id !== file.id),
      fileCount: Math.max(0, drop.fileCount - 1),
      totalSize: Math.max(0, drop.totalSize - file.size),
    })
    onRefresh()
    refreshStorageUsage()
    toast.success(t('drops.files.deleted'))
    closeDialog()
  }

  return (
    <>
      <DropDetailHeader
        drop={drop}
        onShare={() => setDialog({ kind: 'share' })}
        onEdit={() => setDialog({ kind: 'edit' })}
        onToggle={() => void toggleDrop()}
        onDelete={() => setDialog({ kind: 'delete' })}
      />
      <DropStats drop={drop} />
      <section className="flex flex-col gap-4" aria-labelledby="drop-files-title">
        <h2 id="drop-files-title" className="font-heading text-xl font-semibold">
          {t('drops.files.title')}
        </h2>
        {drop.files.length > 0 ? (
          <DropFilesTable
            files={drop.files}
            actions={{
              onDownload: (file) => void download(file),
              onDelete: (file) => setDialog({ kind: 'deleteFile', file }),
            }}
          />
        ) : (
          <LinksPlaceholder icon={Inbox} title={t('drops.files.emptyTitle')} body={t('drops.files.emptyBody')} />
        )}
      </section>
      {dialog.kind === 'share' && (
        <ShareDropFilesDialog
          open
          dropId={drop.id}
          files={drop.files}
          onOpenChange={handleOpenChange}
          onShared={(share) => {
            toast.success(t('shares.created'))
            void navigate(shareDetailPath(share.id))
          }}
          onStale={onRefresh}
        />
      )}
      <DropFormDialog open={dialog.kind === 'edit'} drop={drop} onOpenChange={handleOpenChange} onSaved={handleSaved} />
      <ConfirmDeleteDialog
        open={dialog.kind === 'delete'}
        title={t('drops.delete.title')}
        description={t('drops.delete.description', { slug: drop.id })}
        onOpenChange={handleOpenChange}
        onConfirm={confirmDeleteDrop}
        errorMessage={(error) => extractErrorMessage(error, undefined, dropErrorMessages(t))}
      />
      {dialog.kind === 'deleteFile' && (
        <ConfirmDeleteDialog
          open
          title={t('drops.files.deleteTitle')}
          description={t('drops.files.deleteDescription', { name: dialog.file.name })}
          onOpenChange={handleOpenChange}
          onConfirm={() => confirmDeleteFile(dialog.file)}
          errorMessage={(error) => extractErrorMessage(error, undefined, dropFileDeleteErrorMessages(t))}
        />
      )}
    </>
  )
}

export function DropDetail() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { state, reload, refresh, replace } = useDropDetail(id)
  useDocumentTitle(dropPath(id))

  return (
    <>
      <BackLink />
      {state.status === 'loading' && <Skeleton className="h-16 w-full max-w-lg" aria-busy="true" />}
      {state.status === 'notFound' && (
        <LinksPlaceholder icon={SearchX} title={t('drops.notFoundTitle')} body={t('drops.errors.notFound')} />
      )}
      {state.status === 'error' && (
        <LinksPlaceholder
          icon={Inbox}
          title={t('drops.loadFailedTitle')}
          body={t('links.loadFailedBody')}
          action={
            <Button variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {state.status === 'ready' && <DropView drop={state.value} onChanged={replace} onRefresh={refresh} />}
    </>
  )
}
