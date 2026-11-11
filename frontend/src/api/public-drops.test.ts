import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publicApiClient } from '#lib/public-api-client'
import { announceDropUpload, cancelDropUpload, DROP_UPLOAD_TOKEN_HEADER, uploadDropPart } from './public-drops'

vi.mock('#lib/public-api-client', () => ({
  publicApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

beforeEach(() => vi.resetAllMocks())

describe('public drops API', () => {
  it('omits an empty Turnstile token and an empty name', async () => {
    vi.mocked(publicApiClient.post).mockResolvedValue({ data: { data: {} } })

    await announceDropUpload('drop1234', { name: 'a.bin', size: 3, sha256: 'ab', turnstileToken: '', uploaderName: null })

    expect(publicApiClient.post).toHaveBeenCalledWith('/public/drops/drop1234/files', {
      name: 'a.bin',
      size: 3,
      sha256: 'ab',
      turnstileToken: undefined,
      uploaderName: undefined,
    })
  })

  it('sends the upload token header with a part and a cancellation', async () => {
    const handle = { fileId: 'file1234', uploadToken: 'token-123' }
    const body = new Blob(['a'])

    await uploadDropPart('drop1234', handle, 2, body, { signal: new AbortController().signal, onProgress: vi.fn() })
    await cancelDropUpload('drop1234', handle)

    expect(publicApiClient.put).toHaveBeenCalledWith(
      '/public/drops/drop1234/files/file1234/parts/2',
      body,
      expect.objectContaining({
        headers: { 'Content-Type': 'application/octet-stream', [DROP_UPLOAD_TOKEN_HEADER]: 'token-123' },
      }),
    )
    expect(publicApiClient.delete).toHaveBeenCalledWith('/public/drops/drop1234/files/file1234', {
      headers: { [DROP_UPLOAD_TOKEN_HEADER]: 'token-123' },
    })
  })
})
