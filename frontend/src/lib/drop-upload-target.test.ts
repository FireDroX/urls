import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  announceDropUpload,
  cancelDropUpload,
  completeDropUpload,
  listDropParts,
  uploadDropPart,
} from '#api/public-drops'
import { dropUploadTarget } from './drop-upload-target'
import { TurnstileGate } from './turnstile-gate'

vi.mock('#api/public-drops', () => ({
  announceDropUpload: vi.fn(),
  cancelDropUpload: vi.fn(),
  completeDropUpload: vi.fn(),
  listDropParts: vi.fn(),
  uploadDropPart: vi.fn(),
}))

const handle = { fileId: 'file1234', uploadToken: 'token-123' }

function openGate() {
  return new TurnstileGate({ required: false, onConsumed: vi.fn() })
}

beforeEach(() => vi.resetAllMocks())

describe('dropUploadTarget', () => {
  it('announces with the proof as Turnstile token and the uploader name', async () => {
    vi.mocked(announceDropUpload).mockResolvedValue({
      fileId: 'file1234',
      partSize: 10,
      partCount: 1,
      uploadToken: 'token-123',
      file: {} as never,
    })
    const target = dropUploadTarget('drop1234', { gate: openGate(), uploaderName: () => 'Ada' })

    const announced = await target.announce({ name: 'a.bin', size: 3, sha256: 'ab' }, 'proof')

    expect(announceDropUpload).toHaveBeenCalledWith('drop1234', {
      name: 'a.bin',
      size: 3,
      sha256: 'ab',
      turnstileToken: 'proof',
      uploaderName: 'Ada',
    })
    expect(announced).toEqual({ fileId: 'file1234', partSize: 10, uploadToken: 'token-123' })
  })

  it('asks the gate for the proof', async () => {
    const gate = new TurnstileGate({ required: true, onConsumed: vi.fn() })
    gate.provide('tok')
    const target = dropUploadTarget('drop1234', { gate, uploaderName: () => null })

    await expect(target.beforeAnnounce?.(new AbortController().signal)).resolves.toBe('tok')
  })

  it('forwards the handle with its token to every later call', async () => {
    const target = dropUploadTarget('drop1234', { gate: openGate(), uploaderName: () => null })
    const body = new Blob(['a'])
    const options = { signal: new AbortController().signal, onProgress: vi.fn() }

    await target.listParts(handle)
    await target.sendPart(handle, 2, body, options)
    await target.complete(handle)
    await target.cancel(handle)

    expect(listDropParts).toHaveBeenCalledWith('drop1234', handle)
    expect(uploadDropPart).toHaveBeenCalledWith('drop1234', handle, 2, body, options)
    expect(completeDropUpload).toHaveBeenCalledWith('drop1234', handle)
    expect(cancelDropUpload).toHaveBeenCalledWith('drop1234', handle)
  })
})
