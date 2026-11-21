import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListParams, Page } from '#api/list-params'
import { listLinks, type Link } from '#api/links'
import { useLinks } from './useLinks'

vi.mock('#api/links', () => ({ listLinks: vi.fn() }))

const link = (id: string) => ({ id }) as Link
const pageOf = (id: string): Page<Link> => ({ items: [link(id)], total: 1, page: 1, pageSize: 50 })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('useLinks', () => {
  it('requests the page described by the params', async () => {
    vi.mocked(listLinks).mockResolvedValue(pageOf('a'))
    const { result } = renderHook(() => useLinks({ q: 'a', page: 2 }))

    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    expect(listLinks).toHaveBeenCalledWith({ q: 'a', page: 2 })
    expect(result.current.state).toMatchObject({ total: 1, page: 1, pageSize: 50 })
  })

  it('ignores a stale response that arrives after a newer one', async () => {
    const first = deferred<Page<Link>>()
    const second = deferred<Page<Link>>()
    vi.mocked(listLinks).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(({ params }: { params: ListParams }) => useLinks(params), {
      initialProps: { params: { q: 'old' } },
    })

    rerender({ params: { q: 'new' } })
    second.resolve(pageOf('new'))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    await act(async () => {
      first.resolve(pageOf('old'))
      await first.promise
    })

    expect(result.current.state).toMatchObject({ links: [{ id: 'new' }] })
  })

  it('refreshes without going back to the loading state', async () => {
    vi.mocked(listLinks).mockResolvedValueOnce(pageOf('a')).mockResolvedValueOnce(pageOf('b'))
    const { result } = renderHook(() => useLinks({}))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))

    act(() => result.current.refresh())

    expect(result.current.state.status).toBe('ready')
    await waitFor(() => expect(result.current.state).toMatchObject({ links: [{ id: 'b' }] }))
  })
})
