import { useEffect, useMemo } from 'react'
import { Link2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { ALL_LINKS_LIST_STATES, LINK_TYPES } from '#api/list-params'
import { AllLinksTable } from '#components/dashboard/AllLinksTable'
import type { OrganizationSelection } from '#components/links/LinkOrganizationSummary'
import { LinksPlaceholder } from '#components/links/LinksPlaceholder'
import { FilteredEmpty } from '#components/lists/FilteredEmpty'
import { ListFilterBar } from '#components/lists/ListFilterBar'
import { ListPagination } from '#components/lists/ListPagination'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useAllLinks, type AllLinksState } from '#hooks/useAllLinks'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useLinkOrganizationOptions } from '#hooks/useLinkOrganizationOptions'
import { useListView } from '#hooks/useListView'
import { listViewToParams } from '#utils/list-view'

const ROUTE_CODE = <code className="font-mono text-primary" />
const SKELETON_ROWS = 3

interface AllLinksContentProps {
  state: AllLinksState
  isFiltered: boolean
  selection: OrganizationSelection
  onRetry: () => void
  onClear: () => void
  onPageChange: (page: number) => void
}

function AllLinksContent({ state, isFiltered, selection, onRetry, onClear, onPageChange }: AllLinksContentProps) {
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
        title={t('dashboard.loadFailedTitle')}
        body={t('dashboard.loadFailedBody')}
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
    return (
      <section
        aria-label={t('dashboard.linksRegion')}
        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-muted-foreground">
          <Link2 className="size-5" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-lg font-semibold">{t('dashboard.emptyTitle')}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          <Trans i18nKey="dashboard.emptyBody" components={{ r: ROUTE_CODE, d: ROUTE_CODE, u: ROUTE_CODE }} />
        </p>
      </section>
    )
  }
  return (
    <>
      <AllLinksTable links={state.links} selection={selection} />
      <ListPagination page={state.page} pageSize={state.pageSize} total={state.total} onPageChange={onPageChange} />
    </>
  )
}

export function Dashboard() {
  const { t } = useTranslation()
  useDocumentTitle(t('dashboard.title'))
  const { view, setFilters, setPage, clearFilters, isFiltered } = useListView(ALL_LINKS_LIST_STATES, LINK_TYPES)
  const params = useMemo(() => listViewToParams(view), [view])
  const { state, reload } = useAllLinks(params)
  const { options } = useLinkOrganizationOptions()
  const selection: OrganizationSelection = {
    onTagSelect: (tag) => setFilters({ tag: tag.id }),
    onFolderSelect: (folder) => setFilters({ folder: folder.id }),
  }
  const types = LINK_TYPES.map((value) => ({ value, label: t(`linkTypes.${value}`) }))
  const states = ALL_LINKS_LIST_STATES.map((value) => ({ value, label: t(`dashboard.state.${value}`) }))
  const lastPage = state.status === 'ready' ? Math.max(1, Math.ceil(state.total / state.pageSize)) : null
  const beyondLastPage = state.status === 'ready' && state.links.length === 0 && state.total > 0

  useEffect(() => {
    if (beyondLastPage && lastPage !== null) setPage(lastPage)
  }, [beyondLastPage, lastPage, setPage])

  return (
    <>
      <div>
        <h1 className="font-heading text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>
      <ListFilterBar
        view={view}
        types={types}
        states={states}
        tags={options.tags}
        folders={options.folders}
        searchPlaceholder={t('listFilters.placeholders.all')}
        onChange={setFilters}
      />
      <AllLinksContent
        state={state}
        isFiltered={isFiltered}
        selection={selection}
        onRetry={reload}
        onClear={clearFilters}
        onPageChange={setPage}
      />
    </>
  )
}
