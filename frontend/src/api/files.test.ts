import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '#lib/api-client'
import { createFileDownloadUrl, deleteFile, listFiles } from './files'

vi.mock('#lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

function envelope<T>(data: T) {
  return { data: { status: 'success', data } }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('files api', () => {
  it('lists every file without any query parameter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(envelope({ files: [], summary: {} }))

    await expect(listFiles(false)).resolves.toEqual({ files: [], summary: {} })
    expect(apiClient.get).toHaveBeenCalledWith('/files', { params: undefined })
  })

  it('asks only for the orphans', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(envelope({ files: [], summary: {} }))

    await listFiles(true)

    expect(apiClient.get).toHaveBeenCalledWith('/files', { params: { orphans: 'true' } })
  })

  it('deletes a file, escaping the id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({})

    await deleteFile('a b')

    expect(apiClient.delete).toHaveBeenCalledWith('/files/a%20b')
  })

  it('returns the download url', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(envelope({ url: 'https://cdn.example/f' }))

    await expect(createFileDownloadUrl('abc')).resolves.toBe('https://cdn.example/f')
    expect(apiClient.post).toHaveBeenCalledWith('/files/abc/download')
  })
})
