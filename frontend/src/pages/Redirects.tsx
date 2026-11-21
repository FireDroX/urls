import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LINK_HEALTH_FILTERS, LINK_LIST_STATES } from '#api/list-params'
import { updateLink, type Link } from '#api/links'
import { DeleteLinkDialog } from '#components/links/DeleteLinkDialog'
import { LinkFormDialog } from '#components/links/LinkFormDialog'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import type { OrganizationSelection } from '#components/links/LinkOrganizationSummary'
import { LinksTable, type LinkActions } from '#components/links/LinksTable'
import { FilteredEmpty } from '#components/lists/FilteredEmpty'
import { ListFilterBar } from '#components/lists/ListFilterBar'
import { ListPagination } from '#components/lists/ListPagination'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useCopyLink } from '#hooks/useCopyLink'
import { useCreateRequest } from '#hooks/useCreateRequest'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLinkOrganizationOptions } from '#hooks/useLinkOrganizationOptions'
import { useListView } from '#hooks/useListView'
import { useLinks, type LinksState } from '#hooks/useLinks'
import { extractErrorMessage } from '#lib/api-errors'
import { linkErrorMessages } from '#lib/link-errors'
import { refreshLinkHealth } from '#lib/link-health-refresh'
import { linkDetailPath } from '#utils/link-stats'
import { listViewToParams } from '#utils/list-view'

const NO_TYPES: readonly string[] = []
const SKELETON_ROWS = 3

interface DialogState {
  kind: 'form' | 'delete'
  link?: Link
  open: boolean
}

interface LinksContentProps {
  state: LinksState
  actions: LinkActions
  isFiltered: boolean
  selection: OrganizationSelection
  onRetry: () => void
  onClear: () => void
  onPageChange: (page: number) => void
}

function LinksContent({ state, actions, isFiltered, selection, onRetry, onClear, onPageChange }: LinksContentProps) {
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
  if (state.total === 0 && isFiltered) return <FilteredEmpty onClear={onClear} />
  if (state.total === 0) {
    return <LinksPlaceholder title={t('links.emptyTitle')} body={t('links.emptyBody')} />
  }
  return (
    <>
      <LinksTable links={state.links} actions={actions} selection={selection} />
      <ListPagination page={state.page} pageSize={state.pageSize} total={state.total} onPageChange={onPageChange} />
    </>
  )
}

export function Redirects() {
  const { t } = useTranslation()
  useDocumentTitle(t('links.title'))
  const { view, setFilters, setPage, clearFilters, isFiltered } = useListView(LINK_LIST_STATES, NO_TYPES, LINK_HEALTH_FILTERS)
  const params = useMemo(() => listViewToParams(view), [view])
  const { state, reload, refresh, replace } = useLinks(params)
  const { options } = useLinkOrganizationOptions()
  const selection: OrganizationSelection = {
    onTagSelect: (tag) => setFilters({ tag: tag.id }),
    onFolderSelect: (folder) => setFilters({ folder: folder.id }),
  }
  const states = LINK_LIST_STATES.map((value) => ({ value, label: t(`links.state.${value}`) }))
  const healths = LINK_HEALTH_FILTERS.map((value) => ({ value, label: t(`listFilters.health.${value}`) }))
  const lastPage = state.status === 'ready' ? Math.max(1, Math.ceil(state.total / state.pageSize)) : null
  const beyondLastPage = state.status === 'ready' && state.links.length === 0 && state.total > 0

  useEffect(() => {
    if (beyondLastPage && lastPage !== null) setPage(lastPage)
  }, [beyondLastPage, lastPage, setPage])
  const [dialog, setDialog] = useState<DialogState>({ kind: 'form', open: false })
  const openCreate = useCallback(() => setDialog({ kind: 'form', open: true }), [])
  useCreateRequest(openCreate)
  const copyLink = useCopyLink()
  const navigate = useNavigate()

  function closeDialog() {
    setDialog((current) => ({ ...current, open: false }))
  }

  function handleOpenChange(open: boolean) {
    if (!open) closeDialog()
  }

  function handleCreated() {
    refresh()
    toast.success(t('links.created'))
    closeDialog()
  }

  function handleDeleted() {
    refresh()
    refreshLinkHealth()
    toast.success(t('links.deleted'))
    closeDialog()
  }

  async function toggleLink(link: Link) {
    try {
      const saved = await updateLink(link.id, { disabled: !link.disabled })
      replace(link.id, saved)
      refresh()
      refreshLinkHealth()
      toast.success(saved.disabled ? t('links.disabledToast') : t('links.enabledToast'))
    } catch (error) {
      toast.error(extractErrorMessage(error, undefined, linkErrorMessages(t)))
    }
  }

  const actions: LinkActions = {
    onCopy: (link) => void copyLink(link.id),
    onStats: (link) => void navigate(linkDetailPath(link.id)),
    onEdit: (link) => void navigate(linkDetailPath(link.id)),
    onToggle: (link) => void toggleLink(link),
    onDelete: (link) => setDialog({ kind: 'delete', link, open: true }),
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1>{t('links.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('links.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          {t('links.new')}
        </Button>
      </div>
      <ListFilterBar
        view={view}
        states={states}
        healths={healths}
        tags={options.tags}
        folders={options.folders}
        searchPlaceholder={t('listFilters.placeholders.links')}
        onChange={setFilters}
      />
      <LinksContent
        state={state}
        actions={actions}
        isFiltered={isFiltered}
        selection={selection}
        onRetry={reload}
        onClear={clearFilters}
        onPageChange={setPage}
      />
      <LinkFormDialog
        open={dialog.open && dialog.kind === 'form'}
        onOpenChange={handleOpenChange}
        onSaved={handleCreated}
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
