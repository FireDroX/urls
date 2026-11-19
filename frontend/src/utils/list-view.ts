import {
  LIST_FOLDER_NONE,
  LIST_PAGE_MAX,
  LIST_PAGE_SIZE,
  LIST_SEARCH_MAX_LENGTH,
  LIST_SORTS,
  type ListParams,
  type ListSort,
} from '#api/list-params'

export interface ListView {
  q: string
  tag: string | null
  folder: string | null
  state: string | null
  type: string | null
  sort: ListSort
  page: number
}

export type ListFilters = Partial<Omit<ListView, 'page'>>

export const DEFAULT_SORT: ListSort = 'created_desc'

const PUBLIC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const PAGE_PATTERN = /^\d{1,6}$/

function parseQuery(raw: string | null): string {
  const q = raw?.trim() ?? ''
  return q.length > LIST_SEARCH_MAX_LENGTH ? '' : q
}

function parsePage(raw: string | null): number {
  if (raw === null || !PAGE_PATTERN.test(raw)) return 1
  const page = Number(raw)
  return page >= 1 && page <= LIST_PAGE_MAX ? page : 1
}

export function parseListView(
  params: URLSearchParams,
  states: readonly string[],
  types: readonly string[] = [],
): ListView {
  const tag = params.get('tag')
  const folder = params.get('folder')
  const state = params.get('state')
  const type = params.get('type')
  const sort = params.get('sort')
  return {
    q: parseQuery(params.get('q')),
    tag: tag !== null && PUBLIC_ID_PATTERN.test(tag) ? tag : null,
    folder: folder !== null && (folder === LIST_FOLDER_NONE || PUBLIC_ID_PATTERN.test(folder)) ? folder : null,
    state: state !== null && states.includes(state) ? state : null,
    type: type !== null && types.includes(type) ? type : null,
    sort: LIST_SORTS.find((candidate) => candidate === sort) ?? DEFAULT_SORT,
    page: parsePage(params.get('page')),
  }
}

export function listViewToSearchParams(view: ListView): URLSearchParams {
  const params = new URLSearchParams()
  if (view.q) params.set('q', view.q)
  if (view.tag) params.set('tag', view.tag)
  if (view.folder) params.set('folder', view.folder)
  if (view.state) params.set('state', view.state)
  if (view.type) params.set('type', view.type)
  if (view.sort !== DEFAULT_SORT) params.set('sort', view.sort)
  if (view.page > 1) params.set('page', String(view.page))
  return params
}

export function listViewToParams(view: ListView): ListParams {
  const params: ListParams = { page: view.page, pageSize: LIST_PAGE_SIZE }
  if (view.q) params.q = view.q
  if (view.tag) params.tag = view.tag
  if (view.folder) params.folder = view.folder
  if (view.state) params.state = view.state
  if (view.type) params.type = view.type
  if (view.sort !== DEFAULT_SORT) params.sort = view.sort
  return params
}

export function isFilteredView(view: ListView): boolean {
  return view.q !== '' || view.tag !== null || view.folder !== null || view.state !== null || view.type !== null
}

export function withFilters(view: ListView, patch: ListFilters): ListView {
  return { ...view, ...patch, page: 1 }
}
