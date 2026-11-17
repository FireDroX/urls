import { LIST_PAGE_SIZE_MAX, type ListParams, type Page } from '#api/list-params'

export async function fetchAllPages<T>(fetchPage: (params: ListParams) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await fetchPage({ page, pageSize: LIST_PAGE_SIZE_MAX })
    items.push(...result.items)
    if (result.items.length === 0 || items.length >= result.total) return items
  }
}
