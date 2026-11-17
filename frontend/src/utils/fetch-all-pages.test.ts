import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from './fetch-all-pages'

describe('fetchAllPages', () => {
  it('returns a single page without further requests', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: ['a', 'b'], total: 2, page: 1, pageSize: 100 })

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a', 'b'])
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({ page: 1, pageSize: 100 })
  })

  it('walks the pages until the total is reached', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: ['a'], total: 3, page: 1, pageSize: 100 })
      .mockResolvedValueOnce({ items: ['b', 'c'], total: 3, page: 2, pageSize: 100 })

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a', 'b', 'c'])
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 2, pageSize: 100 })
  })

  it('stops on an empty page even if the total is not reached', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: ['a'], total: 5, page: 1, pageSize: 100 })
      .mockResolvedValueOnce({ items: [], total: 5, page: 2, pageSize: 100 })

    await expect(fetchAllPages(fetchPage)).resolves.toEqual(['a'])
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('propagates a failure', async () => {
    await expect(fetchAllPages(vi.fn().mockRejectedValue(new Error('down')))).rejects.toThrow('down')
  })
})
