import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LINK_LIST_STATES } from '#api/list-params'
import { useListView } from './useListView'

function setup(entry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ list: useListView(LINK_LIST_STATES), location: useLocation() }), { wrapper })
}

describe('useListView', () => {
  it('reads the view from the URL and ignores unknown values', () => {
    const { result } = setup('/redirects?q=docs&state=bogus&page=2')

    expect(result.current.list.view).toMatchObject({ q: 'docs', state: null, page: 2 })
    expect(result.current.list.isFiltered).toBe(true)
  })

  it('writes a filter to the URL and goes back to the first page', () => {
    const { result } = setup('/redirects?page=3&sort=slug_asc')

    act(() => result.current.list.setFilters({ tag: 't1' }))

    expect(result.current.location.search).toBe('?tag=t1&sort=slug_asc')
    expect(result.current.list.view.page).toBe(1)
  })

  it('changes the page without touching the filters', () => {
    const { result } = setup('/redirects?q=docs')

    act(() => result.current.list.setPage(2))

    expect(result.current.location.search).toBe('?q=docs&page=2')
  })

  it('clears the filters but keeps the sort', () => {
    const { result } = setup('/redirects?q=docs&tag=t1&sort=slug_desc&page=2')

    act(() => result.current.list.clearFilters())

    expect(result.current.location.search).toBe('?sort=slug_desc')
    expect(result.current.list.isFiltered).toBe(false)
  })
})
