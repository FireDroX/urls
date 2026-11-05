import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Copy, FolderUp, Pencil, Power, PowerOff, SearchX, Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import {
  deleteShare,
  deleteShareFile,
  shareDetailPath,
  sharePath,
  shareUrl,
  updateShare,
  type ShareDetail as ShareDetailData,
  type ShareFile,
} from '#api/shares'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { LinkStateBadge } from '#components/links/LinkStateBadge'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { FileDropZone } from '#components/shares/FileDropZone'
import { ShareFilesTable } from '#components/shares/ShareFilesTable'
import { ShareFormDialog } from '#components/shares/ShareFormDialog'
import { UploadsList } from '#components/shares/UploadsList'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useFileSize } from '#hooks/useFileSize'
import { useShareDetail } from '#hooks/useShareDetail'
import { useUploads, type UseUploads } from '#hooks/useUploads'
import { extractErrorMessage } from '#lib/api-errors'
import { shareErrorMessages, shareFileErrorMessages } from '#lib/share-errors'
import { isActiveUpload } from '#lib/upload-queue'
import { createUploadFileSchema, FILE_MAX_SIZE_BYTES } from '#schemas/share.schema'
import { forgetShareUploads } from '#utils/pending-uploads'

const SHARES_LIST_PATH = '/shares'

type DialogState = { kind: 'closed' } | { kind: 'edit' } | { kind: 'delete' } | { kind: 'deleteFile'; file: ShareFile }

function BackLink() {
  const { t } = useTranslation()

  return (
    <RouterLink
      to={SHARES_LIST_PATH}
      className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('shares.backToList')}
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

function ShareStats({ share }: { share: ShareDetailData }) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()
  const expiry = useMemo(() => {
    if (!share.expiresAt) return t('links.noExpiry')
    const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
    return formatter.format(new Date(share.expiresAt))
  }, [share.expiresAt, i18n.language, t])

  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={t('shares.detail.views')}>{share.viewCount}</Stat>
      <Stat label={t('shares.detail.downloads')}>
        {share.maxDownloads === null
          ? share.downloadCount
          : t('shares.downloadsOfMax', { current: share.downloadCount, max: share.maxDownloads })}
      </Stat>
      <Stat label={t('links.columns.expiresAt')}>{expiry}</Stat>
      <Stat label={t('shares.detail.totalSize')}>{formatSize(share.totalSize)}</Stat>
    </dl>
  )
}

function useValidatedFiles(onValid: (files: File[]) => void): (files: File[]) => void {
  const { t } = useTranslation()
  const formatSize = useFileSize()

  return (files) => {
    const schema = createUploadFileSchema(t, formatSize(FILE_MAX_SIZE_BYTES))
    const valid = files.filter((file) => {
      const result = schema.safeParse({ name: file.name, size: file.size })
      if (!result.success) {
        toast.error(t('shares.validation.fileRefused', { name: file.name, reason: result.error.issues[0].message }))
      }
      return result.success
    })
    if (valid.length > 0) onValid(valid)
  }
}

interface FilesSectionProps {
  files: ShareFile[]
  uploads: UseUploads
  onDelete: (file: ShareFile) => void
}

function FilesSection({ files, uploads, onDelete }: FilesSectionProps) {
  const { t } = useTranslation()
  const addFiles = useValidatedFiles(uploads.addFiles)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="share-files-title">
      <h2 id="share-files-title" className="font-heading text-xl font-semibold">
        {t('shares.files.title')}
      </h2>
      <FileDropZone onFiles={addFiles} />
      <UploadsList items={uploads.items} onCancel={uploads.cancel} onDismiss={uploads.dismiss} />
      {files.length > 0 ? (
        <ShareFilesTable
          files={files}
          actions={{ onResume: (file, selected) => uploads.resume(file.id, selected), onDelete }}
        />
      ) : (
        uploads.items.length === 0 && (
          <LinksPlaceholder icon={FolderUp} title={t('shares.files.emptyTitle')} body={t('shares.files.emptyBody')} />
        )
      )}
    </section>
  )
}

function ShareHeader({
  share,
  onEdit,
  onToggle,
  onDelete,
}: {
  share: ShareDetailData
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const copyLink = useCopyLink(shareUrl)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-2xl font-bold text-primary">{sharePath(share.id)}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('links.copy', { slug: share.id })}
          onClick={() => void copyLink(share.id)}
        >
          <Copy />
        </Button>
        <LinkStateBadge link={share} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit}>
          <Pencil />
          {t('links.edit')}
        </Button>
        <Button variant="outline" onClick={onToggle}>
          {share.disabled ? <Power /> : <PowerOff />}
          {share.disabled ? t('links.enable') : t('links.disable')}
        </Button>
        <Button variant="outline" onClick={onDelete}>
          <Trash />
          {t('links.delete.action')}
        </Button>
      </div>
    </div>
  )
}

function ShareView({ share, uploads, onChanged }: { share: ShareDetailData; uploads: UseUploads; onChanged: (share: ShareDetailData) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' })
  const activeFileIds = useMemo(
    () => new Set(uploads.items.filter(isActiveUpload).flatMap(({ fileId }) => fileId ?? [])),
    [uploads.items],
  )
  const listedFiles = share.files.filter((file) => !activeFileIds.has(file.id))

  useEffect(() => {
    const uploadingIds = share.files.filter((file) => file.status === 'uploading').map((file) => file.id)
    forgetShareUploads(share.id, new Set([...uploadingIds, ...activeFileIds]))
  }, [share, activeFileIds])

  function closeDialog() {
    setDialog({ kind: 'closed' })
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleSaved(saved: ShareDetailData) {
    closeDialog()
    onChanged(saved)
    toast.success(t('shares.updated'))
    if (saved.id !== share.id) {
      void navigate(shareDetailPath(saved.id), { replace: true })
    }
  }

  async function toggleShare() {
    try {
      const saved = await updateShare(share.id, { disabled: !share.disabled })
      onChanged(saved)
      toast.success(saved.disabled ? t('shares.disabledToast') : t('shares.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, shareErrorMessages(t)))
    }
  }

  async function confirmDeleteShare() {
    await deleteShare(share.id)
    forgetShareUploads(share.id)
    toast.success(t('shares.deleted'))
    void navigate(SHARES_LIST_PATH, { replace: true })
  }

  async function confirmDeleteFile(file: ShareFile) {
    await deleteShareFile(share.id, file.id)
    uploads.dismissFailed(file.id)
    onChanged({
      ...share,
      files: share.files.filter((item) => item.id !== file.id),
      fileCount: share.fileCount - 1,
      totalSize: share.totalSize - file.size,
    })
    toast.success(t('shares.files.deleted'))
    closeDialog()
  }

  return (
    <>
      <ShareHeader
        share={share}
        onEdit={() => setDialog({ kind: 'edit' })}
        onToggle={() => void toggleShare()}
        onDelete={() => setDialog({ kind: 'delete' })}
      />
      <ShareStats share={share} />
      <FilesSection
        files={listedFiles}
        uploads={uploads}
        onDelete={(file) => setDialog({ kind: 'deleteFile', file })}
      />
      <ShareFormDialog
        open={dialog.kind === 'edit'}
        share={share}
        onOpenChange={handleOpenChange}
        onSaved={handleSaved}
      />
      <ConfirmDeleteDialog
        open={dialog.kind === 'delete'}
        title={t('shares.delete.title')}
        description={t('shares.delete.description', { slug: share.id })}
        onOpenChange={handleOpenChange}
        onConfirm={confirmDeleteShare}
        errorMessage={(error) => extractErrorMessage(error, undefined, shareErrorMessages(t))}
      />
      {dialog.kind === 'deleteFile' && (
        <ConfirmDeleteDialog
          open
          title={t('shares.files.deleteTitle')}
          description={t('shares.files.deleteDescription', { name: dialog.file.name })}
          onOpenChange={handleOpenChange}
          onConfirm={() => confirmDeleteFile(dialog.file)}
          errorMessage={(error) => extractErrorMessage(error, undefined, shareFileErrorMessages(t))}
        />
      )}
    </>
  )
}

export function ShareDetail() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const uploads = useUploads(id)
  const { state, reload, replace } = useShareDetail(id, uploads.revision)
  useDocumentTitle(sharePath(id))

  return (
    <>
      <BackLink />
      {state.status === 'loading' && <Skeleton className="h-16 w-full max-w-lg" aria-busy="true" />}
      {state.status === 'notFound' && (
        <LinksPlaceholder icon={SearchX} title={t('shares.notFoundTitle')} body={t('shares.errors.notFound')} />
      )}
      {state.status === 'error' && (
        <LinksPlaceholder
          icon={FolderUp}
          title={t('shares.loadFailedTitle')}
          body={t('links.loadFailedBody')}
          action={
            <Button variant="outline" onClick={reload}>
              {t('common.retry')}
            </Button>
          }
        />
      )}
      {state.status === 'ready' && <ShareView share={state.value} uploads={uploads} onChanged={replace} />}
    </>
  )
}
