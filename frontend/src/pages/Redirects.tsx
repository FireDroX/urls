import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { updateLink, type Link } from '#api/links'
import { DeleteLinkDialog } from '#components/links/DeleteLinkDialog'
import { LinkFormDialog } from '#components/links/LinkFormDialog'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { LinksTable, type LinkActions } from '#components/links/LinksTable'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLinks, type LinksState } from '#hooks/useLinks'
import { extractErrorMessage } from '#lib/api-errors'
import { linkErrorMessages } from '#lib/link-errors'
import { linkDetailPath } from '#utils/link-stats'

const SKELETON_ROWS = 3

interface DialogState {
  kind: 'form' | 'delete'
  link?: Link
  open: boolean
}

function LinksContent({ state, actions, onRetry }: { state: LinksState; actions: LinkActions; onRetry: () => void }) {
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
        title={t('links.loadFailedTitle')}
        body={t('links.loadFailedBody')}
        action={
          <Button variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  }
  if (state.links.length === 0) {
    return <LinksPlaceholder title={t('links.emptyTitle')} body={t('links.emptyBody')} />
  }
  return <LinksTable links={state.links} actions={actions} />
}

export function Redirects() {
  const { t } = useTranslation()
  useDocumentTitle(t('links.title'))
  const { state, reload, add, replace, remove } = useLinks()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'form', open: false })
  const copyLink = useCopyLink()
  const navigate = useNavigate()

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleSaved(saved: Link) {
    if (dialog.link) {
      replace(dialog.link.id, saved)
      toast.success(t('links.updated'))
    } else {
      add(saved)
      toast.success(t('links.created'))
    }
    closeDialog()
  }

  function handleDeleted(deleted: Link) {
    remove(deleted.id)
    toast.success(t('links.deleted'))
    closeDialog()
  }

  async function toggleLink(link: Link) {
    try {
      const saved = await updateLink(link.id, { disabled: !link.disabled })
      replace(link.id, saved)
      toast.success(saved.disabled ? t('links.disabledToast') : t('links.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, linkErrorMessages(t)))
    }
  }

  const actions: LinkActions = {
    onCopy: (link) => void copyLink(link.id),
    onStats: (link) => void navigate(linkDetailPath(link.id)),
    onEdit: (link) => setDialog({ kind: 'form', link, open: true }),
    onToggle: (link) => void toggleLink(link),
    onDelete: (link) => setDialog({ kind: 'delete', link, open: true }),
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">{t('links.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('links.subtitle')}</p>
        </div>
        <Button onClick={() => setDialog({ kind: 'form', open: true })}>
          <Plus />
          {t('links.new')}
        </Button>
      </div>
      <LinksContent state={state} actions={actions} onRetry={reload} />
      <LinkFormDialog
        open={dialog.open && dialog.kind === 'form'}
        link={dialog.link}
        onOpenChange={handleOpenChange}
        onSaved={handleSaved}
      />
      <DeleteLinkDialog
        open={dialog.open && dialog.kind === 'delete'}
        link={dialog.link}
        onOpenChange={handleOpenChange}
        onDeleted={handleDeleted}
      />
    </>
  )
}
