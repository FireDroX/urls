import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  isFilteredView,
  listViewToSearchParams,
  parseListView,
  withFilters,
  type ListFilters,
  type ListView,
} from '#utils/list-view'

export interface UseListView {
  view: ListView
  isFiltered: boolean
  setFilters: (patch: ListFilters) => void
  setPage: (page: number) => void
  clearFilters: () => void
}

const NO_TYPES: readonly string[] = []

export function useListView(states: readonly string[], types: readonly string[] = NO_TYPES): UseListView {
  const [searchParams, setSearchParams] = useSearchParams()
  const key = searchParams.toString()
  const view = useMemo(() => parseListView(new URLSearchParams(key), states, types), [key, states, types])

  const write = useCallback(
    (next: ListView) => setSearchParams(listViewToSearchParams(next), { replace: true }),
    [setSearchParams],
  )

  const setFilters = useCallback((patch: ListFilters) => write(withFilters(view, patch)), [view, write])
  const setPage = useCallback((page: number) => write({ ...view, page }), [view, write])
  const clearFilters = useCallback(
    () => write({ q: '', tag: null, folder: null, state: null, type: null, sort: view.sort, page: 1 }),
    [view.sort, write],
  )

  return { view, isFiltered: isFilteredView(view), setFilters, setPage, clearFilters }
}
