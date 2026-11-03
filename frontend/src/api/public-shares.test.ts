import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '#lib/api-client'
import { getPublicShare, requestShareDownload } from './public-shares'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('public shares api', () => {
  it('reads the share preview with each id kept as a single path segment', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { status: 'success', data: { id: 'x' } } })

    await getPublicShare('../links')

    expect(get).toHaveBeenCalledWith('/public/shares/..%2Flinks', { signal: undefined })
  })

  it('asks a download URL with the Turnstile token and returns it', async () => {
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { status: 'success', data: { url: 'https://cdn.example/file' } } })

    await expect(requestShareDownload('share123', 'a/b', 'token')).resolves.toBe('https://cdn.example/file')

    expect(post).toHaveBeenCalledWith('/public/shares/share123/files/a%2Fb/download', { turnstileToken: 'token' })
  })
})
