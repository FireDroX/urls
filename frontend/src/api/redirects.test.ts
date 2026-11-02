import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRedirectStatus, redirectPath } from './redirects'

function mockFetch(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getRedirectStatus', () => {
  it('asks the redirect route without following the redirect nor caching it', async () => {
    const fetchMock = mockFetch({ type: 'basic', status: 404 })

    await getRedirectStatus('abc 123')

    expect(fetchMock).toHaveBeenCalledWith(
      '/r/abc%20123',
      expect.objectContaining({ redirect: 'manual', cache: 'no-store', credentials: 'omit' }),
    )
  })

  it.each([
    [{ type: 'opaqueredirect', status: 0 }, 'active'],
    [{ type: 'basic', status: 410 }, 'expired'],
    [{ type: 'basic', status: 404 }, 'notFound'],
    [{ type: 'basic', status: 429 }, 'notFound'],
  ] as const)('maps %o to %s', async (response, expected) => {
    mockFetch(response)

    await expect(getRedirectStatus('abc123')).resolves.toBe(expected)
  })
})

describe('redirectPath', () => {
  it('encodes the id so it stays a single path segment', () => {
    expect(redirectPath('../api')).toBe('/r/..%2Fapi')
  })
})
