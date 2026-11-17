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
  sort?: string
  page?: number
  pageSize?: number
}
