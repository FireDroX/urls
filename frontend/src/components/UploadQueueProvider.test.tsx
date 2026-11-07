import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadQueueProvider } from '#components/UploadQueueProvider'
import { useUploads, type UseUploads } from '#hooks/useUploads'
import { hashFile } from '#lib/file-hash'
import type { UploadTarget } from '#lib/upload-target'

vi.mock('#lib/file-hash', () => ({ hashFile: vi.fn() }))

const SHA256 = 'ab'.repeat(32)

function fakeTarget(): UploadTarget {
  return {
    announce: vi.fn().mockResolvedValue({ fileId: 'file1234', partSize: 10 }),
    listParts: vi.fn(),
    sendPart: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  }
}

function mount(target: UploadTarget) {
  let uploads: UseUploads | undefined
  function Probe() {
    uploads = useUploads('drop')
    return null
  }
  const view = render(
    <UploadQueueProvider targetOf={() => target}>
      <Probe />
    </UploadQueueProvider>,
  )
  return { view, uploads: () => uploads! }
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(hashFile).mockResolvedValue(SHA256)
})

describe('UploadQueueProvider', () => {
  it('sends a file to the given target, without any session or router', async () => {
    const target = fakeTarget()
    const { uploads } = mount(target)

    act(() => uploads().addFiles([new File(['abc'], 'a.txt')]))

    await vi.waitFor(() => expect(target.complete).toHaveBeenCalled())
    expect(target.announce).toHaveBeenCalledWith({ name: 'a.txt', size: 3, sha256: SHA256 }, undefined)
    expect(target.sendPart).toHaveBeenCalledOnce()
  })

  it('stops the queue when unmounted', async () => {
    const target = fakeTarget()
    vi.mocked(hashFile).mockImplementation(
      (_file, _onHashed, signal) =>
        new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    )
    const { view, uploads } = mount(target)
    act(() => uploads().addFiles([new File(['abc'], 'a.txt')]))
    await vi.waitFor(() => expect(hashFile).toHaveBeenCalled())

    view.unmount()

    await new Promise((resolve) => setTimeout(resolve))
    expect(vi.mocked(hashFile).mock.calls[0][2]?.aborted).toBe(true)
    expect(target.announce).not.toHaveBeenCalled()
  })
})
