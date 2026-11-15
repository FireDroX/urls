import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '#lib/api-client'
import {
  completeFileUpload,
  createShare,
  deleteShare,
  deleteShareFile,
  getShare,
  listFileParts,
  listShares,
  shareDetailPath,
  sharePath,
  shareUrl,
  startFileUpload,
  updateShare,
  uploadFilePart,
} from './shares'

vi.mock('#lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function envelope<T>(data: T) {
  return { data: { status: 'success', data } }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('shares api', () => {
  it('builds the public and admin paths, escaping the id', () => {
    expect(sharePath('a b')).toBe('/d/a%20b')
    expect(shareDetailPath('a b')).toBe('/shares/a%20b')
    expect(shareUrl('photos', 'https://url.example')).toBe('https://url.example/d/photos')
  })

  it('lists the shares and unwraps the envelope', async () => {
    const result = { items: [{ id: 'photos' }], total: 1, page: 1, pageSize: 50 }
    vi.mocked(apiClient.get).mockResolvedValue(envelope(result))

    await expect(listShares({ sort: 'slug_asc' })).resolves.toEqual(result)
    expect(apiClient.get).toHaveBeenCalledWith('/shares', { params: { sort: 'slug_asc' } })
  })

  it('gets a share with an abort signal', async () => {
    const { signal } = new AbortController()
    vi.mocked(apiClient.get).mockResolvedValue(envelope({ id: 'photos' }))

    await getShare('photos', signal)

    expect(apiClient.get).toHaveBeenCalledWith('/shares/photos', { signal })
  })

  it('creates, updates and deletes a share', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(envelope({ id: 'photos' }))
    vi.mocked(apiClient.patch).mockResolvedValue(envelope({ id: 'photos' }))

    await createShare({ slug: 'photos' })
    await updateShare('photos', { disabled: true })
    await deleteShare('photos')

    expect(apiClient.post).toHaveBeenCalledWith('/shares', { slug: 'photos' })
    expect(apiClient.patch).toHaveBeenCalledWith('/shares/photos', { disabled: true })
    expect(apiClient.delete).toHaveBeenCalledWith('/shares/photos')
  })

  it('announces a file', async () => {
    const payload = { name: 'a.bin', size: 3, sha256: 'ab'.repeat(32) }
    vi.mocked(apiClient.post).mockResolvedValue(envelope({ fileId: 'file1234' }))

    await expect(startFileUpload('photos', payload)).resolves.toEqual({ fileId: 'file1234' })
    expect(apiClient.post).toHaveBeenCalledWith('/shares/photos/files', payload)
  })

  it('sends a part as raw bytes and reports its progress', async () => {
    const onProgress = vi.fn()
    const { signal } = new AbortController()
    const body = new Blob(['abc'])
    vi.mocked(apiClient.put).mockResolvedValue({})

    await uploadFilePart('photos', 'file1234', 2, body, { signal, onProgress })

    const [url, sent, config] = vi.mocked(apiClient.put).mock.calls[0]
    expect(url).toBe('/shares/photos/files/file1234/parts/2')
    expect(sent).toBe(body)
    expect(config?.headers).toEqual({ 'Content-Type': 'application/octet-stream' })
    expect(config?.signal).toBe(signal)
    config?.onUploadProgress?.({ loaded: 2 } as never)
    expect(onProgress).toHaveBeenCalledWith(2)
  })

  it('lists the parts already received', async () => {
    const parts = { fileId: 'file1234', parts: [{ partNumber: 1, size: 3 }] }
    vi.mocked(apiClient.get).mockResolvedValue(envelope(parts))

    await expect(listFileParts('photos', 'file1234')).resolves.toEqual(parts)
    expect(apiClient.get).toHaveBeenCalledWith('/shares/photos/files/file1234/parts')
  })

  it('completes and deletes a file', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(envelope({ id: 'file1234', status: 'verifying' }))

    await completeFileUpload('photos', 'file1234')
    await deleteShareFile('photos', 'file1234')

    expect(apiClient.post).toHaveBeenCalledWith('/shares/photos/files/file1234/complete')
    expect(apiClient.delete).toHaveBeenCalledWith('/shares/photos/files/file1234')
  })
})
