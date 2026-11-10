import { useState } from 'react'
import { Inbox, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { deleteDrop, dropUrl, updateDrop, type Drop } from '#api/drops'
import { DropFormDialog } from '#components/drops/DropFormDialog'
import { DropsTable, type DropActions } from '#components/drops/DropsTable'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useDrops, type DropsState } from '#hooks/useDrops'
import { extractErrorMessage } from '#lib/api-errors'
import { dropErrorMessages } from '#lib/drop-errors'

const SKELETON_ROWS = 3

interface DialogState {
  kind: 'form' | 'delete'
  drop?: Drop
  open: boolean
}

function DropsContent({ state, actions, onRetry }: { state: DropsState; actions: DropActions; onRetry: () => void }) {
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
        icon={Inbox}
        title={t('drops.loadFailedTitle')}
        body={t('links.loadFailedBody')}
        action={
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }
  if (state.drops.length === 0) {
    return <LinksPlaceholder icon={Inbox} title={t('drops.emptyTitle')} body={t('drops.emptyBody')} />
  }
  return <DropsTable drops={state.drops} actions={actions} />
}

export function Drops() {
  const { t } = useTranslation()
  useDocumentTitle(t('drops.title'))
  const { state, reload, add, replace, remove } = useDrops()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'form', open: false })
  const copyLink = useCopyLink(dropUrl)

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleSaved(saved: Drop) {
    if (dialog.drop) {
      replace(dialog.drop.id, saved)
      toast.success(t('drops.updated'))
    } else {
      add(saved)
      toast.success(t('drops.created'))
    }
    closeDialog()
  }

  async function confirmDelete(drop: Drop) {
    await deleteDrop(drop.id)
    remove(drop.id)
    toast.success(t('drops.deleted'))
    closeDialog()
  }

  async function toggleDrop(drop: Drop) {
    try {
      const saved = await updateDrop(drop.id, { disabled: !drop.disabled })
      replace(drop.id, saved)
      toast.success(saved.disabled ? t('drops.disabledToast') : t('drops.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, dropErrorMessages(t)))
    }
  }

  const actions: DropActions = {
    onCopy: (drop) => void copyLink(drop.id),
    onEdit: (drop) => setDialog({ kind: 'form', drop, open: true }),
    onToggle: (drop) => void toggleDrop(drop),
    onDelete: (drop) => setDialog({ kind: 'delete', drop, open: true }),
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">{t('drops.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('drops.subtitle')}</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'form', open: true })}>
          <Plus />
          {t('drops.new')}
        </Button>
      </div>
      <DropsContent state={state} actions={actions} onRetry={reload} />
      <DropFormDialog
        open={dialog.open && dialog.kind === 'form'}
        drop={dialog.drop}
        onOpenChange={handleOpenChange}
        onSaved={handleSaved}
      />
      {dialog.drop && (
        <ConfirmDeleteDialog
          open={dialog.open && dialog.kind === 'delete'}
          title={t('drops.delete.title')}
          description={t('drops.delete.description', { slug: dialog.drop.id })}
          onOpenChange={handleOpenChange}
          onConfirm={() => confirmDelete(dialog.drop!)}
          errorMessage={(error) => extractErrorMessage(error, undefined, dropErrorMessages(t))}
        />
      )}
    </>
  )
}
