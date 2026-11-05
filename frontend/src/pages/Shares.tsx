import { useState } from 'react'
import { FolderUp, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { deleteShare, shareDetailPath, shareUrl, updateShare, type Share } from '#api/shares'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { ShareFormDialog } from '#components/shares/ShareFormDialog'
import { SharesTable, type ShareActions } from '#components/shares/SharesTable'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useShares, type SharesState } from '#hooks/useShares'
import { extractErrorMessage } from '#lib/api-errors'
import { shareErrorMessages } from '#lib/share-errors'
import { forgetShareUploads } from '#utils/pending-uploads'

const SKELETON_ROWS = 3

interface DialogState {
  kind: 'form' | 'delete'
  share?: Share
  open: boolean
}

function SharesContent({ state, actions, onRetry }: { state: SharesState; actions: ShareActions; onRetry: () => void }) {
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
        icon={FolderUp}
        title={t('shares.loadFailedTitle')}
        body={t('links.loadFailedBody')}
        action={
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }
  if (state.shares.length === 0) {
    return <LinksPlaceholder icon={FolderUp} title={t('shares.emptyTitle')} body={t('shares.emptyBody')} />
  }
  return <SharesTable shares={state.shares} actions={actions} />
}

export function Shares() {
  const { t } = useTranslation()
  useDocumentTitle(t('shares.title'))
  const { state, reload, add, replace, remove } = useShares()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'form', open: false })
  const copyLink = useCopyLink(shareUrl)
  const navigate = useNavigate()

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleSaved(saved: Share) {
    if (dialog.share) {
      replace(dialog.share.id, saved)
      toast.success(t('shares.updated'))
      closeDialog()
    } else {
      add(saved)
      toast.success(t('shares.created'))
      void navigate(shareDetailPath(saved.id))
    }
  }

  async function confirmDelete(share: Share) {
    await deleteShare(share.id)
    forgetShareUploads(share.id)
    remove(share.id)
    toast.success(t('shares.deleted'))
    closeDialog()
  }

  async function toggleShare(share: Share) {
    try {
      const saved = await updateShare(share.id, { disabled: !share.disabled })
      replace(share.id, saved)
      toast.success(saved.disabled ? t('shares.disabledToast') : t('shares.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, shareErrorMessages(t)))
    }
  }

  const actions: ShareActions = {
    onCopy: (share) => void copyLink(share.id),
    onOpen: (share) => void navigate(shareDetailPath(share.id)),
    onEdit: (share) => setDialog({ kind: 'form', share, open: true }),
    onToggle: (share) => void toggleShare(share),
    onDelete: (share) => setDialog({ kind: 'delete', share, open: true }),
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">{t('shares.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('shares.subtitle')}</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'form', open: true })}>
          <Plus />
          {t('shares.new')}
        </Button>
      </div>
      <SharesContent state={state} actions={actions} onRetry={reload} />
      <ShareFormDialog
        open={dialog.open && dialog.kind === 'form'}
        share={dialog.share}
        onOpenChange={handleOpenChange}
        onSaved={handleSaved}
      />
      {dialog.share && (
        <ConfirmDeleteDialog
          open={dialog.open && dialog.kind === 'delete'}
          title={t('shares.delete.title')}
          description={t('shares.delete.description', { slug: dialog.share.id })}
          onOpenChange={handleOpenChange}
          onConfirm={() => confirmDelete(dialog.share!)}
          errorMessage={(error) => extractErrorMessage(error, undefined, shareErrorMessages(t))}
        />
      )}
    </>
  )
}
