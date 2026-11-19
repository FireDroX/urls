import { describe, expect, it } from 'vitest'
import { DROP_LIST_STATES, LINK_HEALTH_FILTERS, LINK_LIST_STATES, LIST_PAGE_SIZE } from '#api/list-params'
import {
  isFilteredView,
  listViewToParams,
  listViewToSearchParams,
  parseListView,
  withFilters,
  type ListView,
} from './list-view'

const parse = (query: string, states: readonly string[] = LINK_LIST_STATES, healths: readonly string[] = []) =>
  parseListView(new URLSearchParams(query), states, healths)

const DEFAULT_VIEW: ListView = { q: '', tag: null, folder: null, state: null, health: null, sort: 'created_desc', page: 1 }

describe('parseListView', () => {
  it('returns the defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULT_VIEW)
  })

  it('reads every valid parameter', () => {
    expect(parse('q=%20docs%20&tag=abc_1-2&folder=none&state=expired&sort=slug_asc&page=3')).toEqual({
      q: 'docs',
      tag: 'abc_1-2',
      folder: 'none',
      state: 'expired',
      health: null,
      sort: 'slug_asc',
      page: 3,
    })
  })

  it('ignores unknown or invalid values', () => {
    const view = parse(`state=open&sort=random&page=0&q=${'a'.repeat(101)}&tag=bad%20tag&folder=a/b&extra=1`)
    expect(view).toEqual(DEFAULT_VIEW)
  })

  it.each(['abc', '2.5', '-1', '100001', '', '0'])('ignores the page %j', (page) => {
    expect(parse(`page=${page}`).page).toBe(1)
  })

  it('accepts the health filters of the given list only', () => {
    expect(parse('health=broken', LINK_LIST_STATES, LINK_HEALTH_FILTERS).health).toBe('broken')
    expect(parse('health=sick', LINK_LIST_STATES, LINK_HEALTH_FILTERS).health).toBeNull()
    expect(parse('health=broken').health).toBeNull()
  })

  it('accepts the states of the given list only', () => {
    expect(parse('state=open', DROP_LIST_STATES).state).toBe('open')
    expect(parse('state=active', DROP_LIST_STATES).state).toBeNull()
  })
})

describe('listViewToSearchParams', () => {
  it('omits the default values', () => {
    expect(listViewToSearchParams(DEFAULT_VIEW).toString()).toBe('')
  })

  it('round-trips a full view', () => {
    const view: ListView = { q: 'a b', tag: 't1', folder: 'none', state: 'disabled', health: 'ok', sort: 'created_asc', page: 2 }
    expect(parse(listViewToSearchParams(view).toString(), LINK_LIST_STATES, LINK_HEALTH_FILTERS)).toEqual(view)
  })
})

describe('listViewToParams', () => {
  it('sends the page size and only the active filters', () => {
    expect(listViewToParams(DEFAULT_VIEW)).toEqual({ page: 1, pageSize: LIST_PAGE_SIZE })
    expect(listViewToParams({ ...DEFAULT_VIEW, q: 'x', tag: 't1', sort: 'slug_desc', page: 4 })).toEqual({
      q: 'x',
      tag: 't1',
      sort: 'slug_desc',
      page: 4,
      pageSize: LIST_PAGE_SIZE,
    })
  })
})

describe('isFilteredView and withFilters', () => {
  it('counts filters but not the sort or the page', () => {
    expect(isFilteredView({ ...DEFAULT_VIEW, sort: 'slug_asc', page: 3 })).toBe(false)
    expect(isFilteredView({ ...DEFAULT_VIEW, folder: 'none' })).toBe(true)
    expect(isFilteredView({ ...DEFAULT_VIEW, health: 'broken' })).toBe(true)
    expect(listViewToParams({ ...DEFAULT_VIEW, health: 'broken' })).toMatchObject({ health: 'broken' })
  })

  it('goes back to the first page when a filter changes', () => {
    expect(withFilters({ ...DEFAULT_VIEW, page: 5 }, { tag: 't1' })).toEqual({ ...DEFAULT_VIEW, tag: 't1', page: 1 })
  })
})
