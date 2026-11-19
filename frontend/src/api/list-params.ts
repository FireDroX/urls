export const LIST_PAGE_SIZE_MAX = 100

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListParams {
  q?: string
  tag?: string
  folder?: string
  state?: string
  health?: string
  sort?: string
  page?: number
  pageSize?: number
}

export const LIST_SEARCH_DEBOUNCE_MS = 300
export const LIST_PAGE_SIZE = 50
export const LIST_SEARCH_MAX_LENGTH = 100
export const LIST_PAGE_MAX = 100000
export const LIST_FOLDER_NONE = 'none'
export const LIST_SORTS = ['created_desc', 'created_asc', 'updated_desc', 'slug_asc', 'slug_desc'] as const
export const LINK_LIST_STATES = ['active', 'disabled', 'expired'] as const
export const LINK_HEALTH_FILTERS = ['broken', 'ok', 'unchecked'] as const
export const DROP_LIST_STATES = ['open', 'full', 'expired', 'disabled'] as const

export type ListSort = (typeof LIST_SORTS)[number]
