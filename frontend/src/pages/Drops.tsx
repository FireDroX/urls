import { useEffect, useMemo, useState } from 'react'
import { Inbox, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { DROP_LIST_STATES } from '#api/list-params'
import { deleteDrop, dropDetailPath, dropUrl, updateDrop, type Drop } from '#api/drops'
import { DropFormDialog } from '#components/drops/DropFormDialog'
import { DropsTable, type DropActions } from '#components/drops/DropsTable'
import type { OrganizationSelection } from '#components/links/LinkOrganizationSummary'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { FilteredEmpty } from '#components/lists/FilteredEmpty'
import { ListFilterBar } from '#components/lists/ListFilterBar'
import { ListPagination } from '#components/lists/ListPagination'
import { ConfirmDeleteDialog } from '#components/shares/ConfirmDeleteDialog'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLinkOrganizationOptions } from '#hooks/useLinkOrganizationOptions'
import { useListView } from '#hooks/useListView'
import { useDrops, type DropsState } from '#hooks/useDrops'
import { extractErrorMessage } from '#lib/api-errors'
import { dropErrorMessages } from '#lib/drop-errors'
import { listViewToParams } from '#utils/list-view'

const SKELETON_ROWS = 3

interface DialogState {
  kind: 'form' | 'delete'
  drop?: Drop
  open: boolean
}

interface DropsContentProps {
  state: DropsState
  actions: DropActions
  isFiltered: boolean
  selection: OrganizationSelection
  onRetry: () => void
  onClear: () => void
  onPageChange: (page: number) => void
}

function DropsContent({ state, actions, isFiltered, selection, onRetry, onClear, onPageChange }: DropsContentProps) {
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
  if (state.total === 0 && isFiltered) return <FilteredEmpty onClear={onClear} />
  if (state.total === 0) {
    return <LinksPlaceholder icon={Inbox} title={t('drops.emptyTitle')} body={t('drops.emptyBody')} />
  }
  return (
    <>
      <DropsTable drops={state.drops} actions={actions} selection={selection} />
      <ListPagination page={state.page} pageSize={state.pageSize} total={state.total} onPageChange={onPageChange} />
    </>
  )
}

export function Drops() {
  const { t } = useTranslation()
  useDocumentTitle(t('drops.title'))
  const { view, setFilters, setPage, clearFilters, isFiltered } = useListView(DROP_LIST_STATES)
  const params = useMemo(() => listViewToParams(view), [view])
  const { state, reload, refresh, replace } = useDrops(params)
  const { options } = useLinkOrganizationOptions()
  const selection: OrganizationSelection = {
    onTagSelect: (tag) => setFilters({ tag: tag.id }),
    onFolderSelect: (folder) => setFilters({ folder: folder.id }),
  }
  const states = DROP_LIST_STATES.map((value) => ({ value, label: t(`drops.state.${value}`) }))
  const lastPage = state.status === 'ready' ? Math.max(1, Math.ceil(state.total / state.pageSize)) : null
  const beyondLastPage = state.status === 'ready' && state.drops.length === 0 && state.total > 0

  useEffect(() => {
    if (beyondLastPage && lastPage !== null) setPage(lastPage)
  }, [beyondLastPage, lastPage, setPage])
  const [dialog, setDialog] = useState<DialogState>({ kind: 'form', open: false })
  const copyLink = useCopyLink(dropUrl)
  const navigate = useNavigate()

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleSaved(saved: Drop) {
    refresh()
    toast.success(t('drops.created'))
    closeDialog()
  }

  async function confirmDelete(drop: Drop) {
    await deleteDrop(drop.id)
    refresh()
    toast.success(t('drops.deleted'))
    closeDialog()
  }

  async function toggleDrop(drop: Drop) {
    try {
      const saved = await updateDrop(drop.id, { disabled: !drop.disabled })
      replace(drop.id, saved)
      refresh()
      toast.success(saved.disabled ? t('drops.disabledToast') : t('drops.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, dropErrorMessages(t)))
    }
  }

  const actions: DropActions = {
    onCopy: (drop) => void copyLink(drop.id),
    onEdit: (drop) => void navigate(dropDetailPath(drop.id)),
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
      <ListFilterBar
        view={view}
        states={states}
        tags={options.tags}
        folders={options.folders}
        searchPlaceholder={t('listFilters.placeholders.drops')}
        onChange={setFilters}
      />
      <DropsContent
        state={state}
        actions={actions}
        isFiltered={isFiltered}
        selection={selection}
        onRetry={reload}
        onClear={clearFilters}
        onPageChange={setPage}
      />
      <DropFormDialog
        open={dialog.open && dialog.kind === 'form'}
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
