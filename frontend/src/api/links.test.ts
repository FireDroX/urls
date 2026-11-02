import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '#lib/api-client'
import { createLink, deleteLink, linkUrl, listLinks, updateLink, type Link } from './links'

vi.mock('#lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const link: Link = {
  id: 'docs',
  type: 'redirect',
  destination: 'https://example.com/',
  expiresAt: null,
  disabled: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

function envelope<T>(data: T) {
  return { data: { status: 'success', data } }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('links api', () => {
  it('lists the links and unwraps the response envelope', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(envelope([link]))

    await expect(listLinks()).resolves.toEqual([link])
    expect(apiClient.get).toHaveBeenCalledWith('/links')
  })

  it('creates a link with the given payload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(envelope(link))
    const payload = { destination: 'https://example.com/', slug: 'docs' }

    await expect(createLink(payload)).resolves.toEqual(link)
    expect(apiClient.post).toHaveBeenCalledWith('/links', payload)
  })

  it('updates a link by its public id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(envelope({ ...link, disabled: true }))

    await expect(updateLink('docs', { disabled: true })).resolves.toMatchObject({ disabled: true })
    expect(apiClient.patch).toHaveBeenCalledWith('/links/docs', { disabled: true })
  })

  it('deletes a link by its public id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ status: 204 })

    await expect(deleteLink('docs')).resolves.toBeUndefined()
    expect(apiClient.delete).toHaveBeenCalledWith('/links/docs')
  })

  it('encodes the id so it stays a single path segment', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ status: 204 })

    await deleteLink('../auth')

    expect(apiClient.delete).toHaveBeenCalledWith('/links/..%2Fauth')
  })

  it('propagates API errors', async () => {
    const error = new Error('conflict')
    vi.mocked(apiClient.post).mockRejectedValue(error)

    await expect(createLink({ destination: 'https://example.com/' })).rejects.toBe(error)
  })
})

describe('linkUrl', () => {
  it('builds the full public redirect URL', () => {
    expect(linkUrl('docs', 'https://url.addrien.fr')).toBe('https://url.addrien.fr/r/docs')
  })

  it('defaults to the current origin', () => {
    expect(linkUrl('docs')).toBe(`${window.location.origin}/r/docs`)
  })
})
