import { useEffect, useMemo, useState } from 'react'
import { FolderUp, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LINK_LIST_STATES } from '#api/list-params'
import { deleteShare, shareDetailPath, shareUrl, updateShare, type Share } from '#api/shares'
import type { OrganizationSelection } from '#components/links/LinkOrganizationSummary'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { FilteredEmpty } from '#components/lists/FilteredEmpty'
import { ListFilterBar } from '#components/lists/ListFilterBar'
import { ListPagination } from '#components/lists/ListPagination'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { ShareFormDialog } from '#components/shares/ShareFormDialog'
import { SharesTable, type ShareActions } from '#components/shares/SharesTable'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLinkOrganizationOptions } from '#hooks/useLinkOrganizationOptions'
import { useListView } from '#hooks/useListView'
import { useShares, type SharesState } from '#hooks/useShares'
import { extractErrorMessage } from '#lib/api-errors'
import { shareErrorMessages } from '#lib/share-errors'
import { forgetShareUploads } from '#utils/pending-uploads'
import { listViewToParams } from '#utils/list-view'

const SKELETON_ROWS = 3

interface DialogState {
  kind: 'form' | 'delete'
  share?: Share
  open: boolean
}

interface SharesContentProps {
  state: SharesState
  actions: ShareActions
  isFiltered: boolean
  selection: OrganizationSelection
  onRetry: () => void
  onClear: () => void
  onPageChange: (page: number) => void
}

function SharesContent({ state, actions, isFiltered, selection, onRetry, onClear, onPageChange }: SharesContentProps) {
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
  if (state.total === 0 && isFiltered) return <FilteredEmpty onClear={onClear} />
  if (state.total === 0) {
    return <LinksPlaceholder icon={FolderUp} title={t('shares.emptyTitle')} body={t('shares.emptyBody')} />
  }
  return (
    <>
      <SharesTable shares={state.shares} actions={actions} selection={selection} />
      <ListPagination page={state.page} pageSize={state.pageSize} total={state.total} onPageChange={onPageChange} />
    </>
  )
}

export function Shares() {
  const { t } = useTranslation()
  useDocumentTitle(t('shares.title'))
  const { view, setFilters, setPage, clearFilters, isFiltered } = useListView(LINK_LIST_STATES)
  const params = useMemo(() => listViewToParams(view), [view])
  const { state, reload, refresh, replace } = useShares(params)
  const { options } = useLinkOrganizationOptions()
  const selection: OrganizationSelection = {
    onTagSelect: (tag) => setFilters({ tag: tag.id }),
    onFolderSelect: (folder) => setFilters({ folder: folder.id }),
  }
  const states = LINK_LIST_STATES.map((value) => ({ value, label: t(`links.state.${value}`) }))
  const lastPage = state.status === 'ready' ? Math.max(1, Math.ceil(state.total / state.pageSize)) : null
  const beyondLastPage = state.status === 'ready' && state.shares.length === 0 && state.total > 0

  useEffect(() => {
    if (beyondLastPage && lastPage !== null) setPage(lastPage)
  }, [beyondLastPage, lastPage, setPage])
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
    refresh()
    toast.success(t('shares.created'))
    void navigate(shareDetailPath(saved.id))
  }

  async function confirmDelete(share: Share) {
    await deleteShare(share.id)
    forgetShareUploads(share.id)
    refresh()
    toast.success(t('shares.deleted'))
    closeDialog()
  }

  async function toggleShare(share: Share) {
    try {
      const saved = await updateShare(share.id, { disabled: !share.disabled })
      replace(share.id, saved)
      refresh()
      toast.success(saved.disabled ? t('shares.disabledToast') : t('shares.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, shareErrorMessages(t)))
    }
  }

  const actions: ShareActions = {
    onCopy: (share) => void copyLink(share.id),
    onOpen: (share) => void navigate(shareDetailPath(share.id)),
    onEdit: (share) => void navigate(shareDetailPath(share.id)),
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
      <ListFilterBar
        view={view}
        states={states}
        tags={options.tags}
        folders={options.folders}
        searchPlaceholder={t('listFilters.placeholders.shares')}
        onChange={setFilters}
      />
      <SharesContent
        state={state}
        actions={actions}
        isFiltered={isFiltered}
        selection={selection}
        onRetry={reload}
        onClear={clearFilters}
        onPageChange={setPage}
      />
      <ShareFormDialog
        open={dialog.open && dialog.kind === 'form'}
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
