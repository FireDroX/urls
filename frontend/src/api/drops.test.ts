import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '#lib/api-client'
import { createDrop, deleteDrop, dropPath, dropUrl, listDrops, updateDrop } from './drops'

vi.mock('#lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function envelope<T>(data: T) {
  return { data: { status: 'success', data } }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('drops api', () => {
  it('builds the public path and URL, escaping the id', () => {
    expect(dropPath('a b')).toBe('/u/a%20b')
    expect(dropUrl('docs', 'https://url.example')).toBe('https://url.example/u/docs')
  })

  it('lists the drops and unwraps the envelope', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(envelope([{ id: 'docs' }]))

    await expect(listDrops()).resolves.toEqual([{ id: 'docs' }])
    expect(apiClient.get).toHaveBeenCalledWith('/drops')
  })

  it('creates a drop', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(envelope({ id: 'docs' }))
    const payload = { slug: 'docs', maxFiles: 5, maxTotalBytes: 1024 }

    await expect(createDrop(payload)).resolves.toEqual({ id: 'docs' })
    expect(apiClient.post).toHaveBeenCalledWith('/drops', payload)
  })

  it('updates a drop by its escaped id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(envelope({ id: 'a b' }))

    await updateDrop('a b', { disabled: true })

    expect(apiClient.patch).toHaveBeenCalledWith('/drops/a%20b', { disabled: true })
  })

  it('deletes a drop', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await deleteDrop('docs')

    expect(apiClient.delete).toHaveBeenCalledWith('/drops/docs')
  })
})
