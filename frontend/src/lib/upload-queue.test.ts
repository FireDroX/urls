import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteShareFile } from '#api/shares'
import { shareUploadTarget } from '#lib/share-upload-target'
import type { UploadTarget } from '#lib/upload-target'
import { UploadCanceledError } from '#lib/share-errors'
import { UploadRequestError } from '#lib/upload-request-error'
import { resumeFile, uploadNewFile, type UploadRequest } from '#lib/share-upload'
import { rememberUpload, recallUpload } from '#utils/pending-uploads'
import { UploadQueue, type UploadItem } from './upload-queue'

vi.mock('#api/shares', () => ({ deleteShareFile: vi.fn() }))
vi.mock('#lib/share-upload', () => ({ uploadNewFile: vi.fn(), resumeFile: vi.fn() }))

const SHARE_ID = 'photos'
const FILE_ID = 'file1234'

function file(name = 'video.mp4'): File {
  return new File(['abc'], name)
}

function items(queue: UploadQueue): readonly UploadItem[] {
  return queue.getSnapshot().items
}

function untilCanceled({ signal }: UploadRequest): Promise<void> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new UploadCanceledError()))
  })
}

async function settled() {
  await vi.waitFor(() => expect(uploadNewFile).toHaveBeenCalled())
  await new Promise((resolve) => setTimeout(resolve))
}

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  vi.mocked(deleteShareFile).mockResolvedValue()
})

describe('UploadQueue', () => {
  it('removes a finished upload and bumps the revision', async () => {
    vi.mocked(uploadNewFile).mockResolvedValue()
    const queue = new UploadQueue(shareUploadTarget)

    queue.addFiles(SHARE_ID, [file()])
    await settled()

    expect(items(queue)).toEqual([])
    expect(queue.getSnapshot().revision).toBe(1)
  })

  it('runs the files of a selection one after the other', async () => {
    let finishFirst = () => {}
    vi.mocked(uploadNewFile)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve
          }),
      )
      .mockResolvedValue()
    const queue = new UploadQueue(shareUploadTarget)

    queue.addFiles(SHARE_ID, [file('a.bin'), file('b.bin')])
    await settled()

    expect(uploadNewFile).toHaveBeenCalledOnce()
    expect(items(queue).map(({ phase }) => phase)).toEqual(['queued', 'queued'])

    finishFirst()
    await vi.waitFor(() => expect(uploadNewFile).toHaveBeenCalledTimes(2))
  })

  it('tracks the phase and the progress reported by the upload', async () => {
    vi.mocked(uploadNewFile).mockImplementation(({ observer }) => {
      observer.onPhase('uploading')
      observer.onHashed(3)
      observer.onSent(2)
      observer.onOpened(FILE_ID)
      return new Promise(() => {})
    })
    const queue = new UploadQueue(shareUploadTarget)

    queue.addFiles(SHARE_ID, [file()])
    await settled()

    expect(items(queue)[0]).toMatchObject({ phase: 'uploading', hashedBytes: 3, sentBytes: 2, fileId: FILE_ID })
  })

  it('keeps a failed upload with its error and carries on with the next file', async () => {
    const failure = new Error('boom')
    vi.mocked(uploadNewFile).mockRejectedValueOnce(failure).mockResolvedValue()
    const queue = new UploadQueue(shareUploadTarget)

    queue.addFiles(SHARE_ID, [file('a.bin'), file('b.bin')])
    await vi.waitFor(() => expect(items(queue)).toHaveLength(1))

    expect(items(queue)[0]).toMatchObject({ name: 'a.bin', phase: 'failed', error: failure })
  })

  it('dismisses a failed upload', async () => {
    vi.mocked(uploadNewFile).mockRejectedValue(new Error('boom'))
    const queue = new UploadQueue(shareUploadTarget)

    queue.addFiles(SHARE_ID, [file()])
    await settled()
    queue.dismiss(items(queue)[0].key)

    expect(items(queue)).toEqual([])
  })

  it('dismisses the failed uploads of a file', async () => {
    vi.mocked(resumeFile).mockRejectedValue(new Error('boom'))
    const queue = new UploadQueue(shareUploadTarget)

    queue.resume({ shareId: SHARE_ID, fileId: FILE_ID }, file())
    await vi.waitFor(() => expect(items(queue)[0].phase).toBe('failed'))
    queue.dismissFailed(FILE_ID)

    expect(items(queue)).toEqual([])
  })

  it('keeps a running upload when dismissing the failures of its file', async () => {
    vi.mocked(resumeFile).mockReturnValue(new Promise(() => {}))
    const queue = new UploadQueue(shareUploadTarget)

    queue.resume({ shareId: SHARE_ID, fileId: FILE_ID }, file())
    await vi.waitFor(() => expect(resumeFile).toHaveBeenCalled())
    queue.dismissFailed(FILE_ID)

    expect(items(queue)).toHaveLength(1)
  })

  describe('cancel', () => {
    it('deletes a file already opened on the server and forgets it', async () => {
      rememberUpload({ shareId: SHARE_ID, fileId: FILE_ID, name: 'a', size: 3, lastModified: 1, sha256: 'ab' })
      vi.mocked(uploadNewFile).mockImplementation((request) => {
        request.observer.onOpened(FILE_ID)
        return untilCanceled(request)
      })
      const queue = new UploadQueue(shareUploadTarget)

      queue.addFiles(SHARE_ID, [file()])
      await settled()
      queue.cancel(items(queue)[0].key)

      await vi.waitFor(() => expect(items(queue)).toEqual([]))
      expect(deleteShareFile).toHaveBeenCalledWith(SHARE_ID, FILE_ID)
      expect(recallUpload(FILE_ID)).toBeUndefined()
    })

    it('calls no API when the file was only being hashed', async () => {
      vi.mocked(uploadNewFile).mockImplementation(untilCanceled)
      const queue = new UploadQueue(shareUploadTarget)

      queue.addFiles(SHARE_ID, [file()])
      await settled()
      queue.cancel(items(queue)[0].key)

      await vi.waitFor(() => expect(items(queue)).toEqual([]))
      expect(deleteShareFile).not.toHaveBeenCalled()
    })

    it('drops a file still waiting without ever starting it', async () => {
      vi.mocked(uploadNewFile).mockReturnValueOnce(new Promise(() => {}))
      const queue = new UploadQueue(shareUploadTarget)

      queue.addFiles(SHARE_ID, [file('a.bin'), file('b.bin')])
      await settled()
      queue.cancel(items(queue)[1].key)

      expect(items(queue).map(({ name }) => name)).toEqual(['a.bin'])
      expect(uploadNewFile).toHaveBeenCalledOnce()
    })

    it('shows the failure when the server refuses the deletion', async () => {
      const failure = new Error('refused')
      vi.mocked(deleteShareFile).mockRejectedValue(failure)
      vi.mocked(uploadNewFile).mockImplementation((request) => {
        request.observer.onOpened(FILE_ID)
        return untilCanceled(request)
      })
      const queue = new UploadQueue(shareUploadTarget)

      queue.addFiles(SHARE_ID, [file()])
      await settled()
      queue.cancel(items(queue)[0].key)

      await vi.waitFor(() => expect(items(queue)[0]).toMatchObject({ phase: 'failed', error: failure }))
    })
  })

  describe('resume', () => {
    it('starts from the known file and replaces its previous failure', async () => {
      vi.mocked(uploadNewFile).mockImplementation(({ observer }) => {
        observer.onOpened(FILE_ID)
        return Promise.reject(new Error('boom'))
      })
      vi.mocked(resumeFile).mockReturnValue(new Promise(() => {}))
      const queue = new UploadQueue(shareUploadTarget)
      queue.addFiles(SHARE_ID, [file()])
      await settled()
      const selected = file()

      queue.resume({ shareId: SHARE_ID, fileId: FILE_ID }, selected)

      await vi.waitFor(() =>
        expect(resumeFile).toHaveBeenCalledWith(expect.objectContaining({ shareId: SHARE_ID, fileId: FILE_ID, file: selected })),
      )
      expect(items(queue)).toHaveLength(1)
      expect(items(queue)[0].phase).toBe('queued')
    })
  })

  describe('stop', () => {
    it('aborts the running upload without deleting it, so it stays resumable', async () => {
      const observed: AbortSignal[] = []
      vi.mocked(uploadNewFile).mockImplementation((request) => {
        request.observer.onOpened(FILE_ID)
        observed.push(request.signal)
        return untilCanceled(request)
      })
      const queue = new UploadQueue(shareUploadTarget)

      queue.addFiles(SHARE_ID, [file('a.bin'), file('b.bin')])
      await settled()
      queue.stop()
      await new Promise((resolve) => setTimeout(resolve))

      expect(observed[0].aborted).toBe(true)
      expect(deleteShareFile).not.toHaveBeenCalled()
      expect(uploadNewFile).toHaveBeenCalledOnce()
      expect(items(queue)).toEqual([])
    })
  })

  it('notifies its subscribers until they unsubscribe', async () => {
    vi.mocked(uploadNewFile).mockResolvedValue()
    const queue = new UploadQueue(shareUploadTarget)
    const listener = vi.fn()
    const unsubscribe = queue.subscribe(listener)

    queue.addFiles(SHARE_ID, [file()])
    await settled()
    unsubscribe()
    const calls = listener.mock.calls.length
    queue.addFiles(SHARE_ID, [file()])

    expect(calls).toBeGreaterThan(0)
    expect(listener).toHaveBeenCalledTimes(calls)
  })
})

describe('UploadQueue with another upload target', () => {
  const TOKEN = 'token-123'

  function fakeTarget(): UploadTarget {
    return {
      announce: vi.fn(),
      listParts: vi.fn(),
      sendPart: vi.fn(),
      complete: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
    }
  }

  it('cancels an opened upload through the target with its token', async () => {
    const target = fakeTarget()
    const targetOf = vi.fn().mockReturnValue(target)
    vi.mocked(uploadNewFile).mockImplementation((request) => {
      request.observer.onTokenIssued(TOKEN)
      request.observer.onOpened(FILE_ID)
      return untilCanceled(request)
    })
    const queue = new UploadQueue(targetOf)

    queue.addFiles(SHARE_ID, [file()])
    await settled()
    queue.cancel(items(queue)[0].key)

    await vi.waitFor(() => expect(items(queue)).toEqual([]))
    expect(targetOf).toHaveBeenCalledWith(SHARE_ID)
    expect(vi.mocked(uploadNewFile).mock.calls[0][0].target).toBe(target)
    expect(target.cancel).toHaveBeenCalledWith({ fileId: FILE_ID, uploadToken: TOKEN })
  })

  it('cancels a resumed upload with the token remembered for its file', async () => {
    const target = fakeTarget()
    rememberUpload({
      shareId: SHARE_ID,
      fileId: FILE_ID,
      name: 'a',
      size: 3,
      lastModified: 1,
      sha256: 'ab',
      uploadToken: TOKEN,
    })
    vi.mocked(resumeFile).mockImplementation(untilCanceled)
    const queue = new UploadQueue(() => target)

    queue.resume({ shareId: SHARE_ID, fileId: FILE_ID }, file())
    await vi.waitFor(() =>
      expect(resumeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: FILE_ID, uploadToken: TOKEN })),
    )
    queue.cancel(items(queue)[0].key)

    await vi.waitFor(() => expect(items(queue)).toEqual([]))
    expect(target.cancel).toHaveBeenCalledWith({ fileId: FILE_ID, uploadToken: TOKEN })
  })

  it('resumes in the same session with the in-memory token when localStorage refuses writes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const target = fakeTarget()
    vi.mocked(uploadNewFile).mockImplementation(({ observer }) => {
      observer.onTokenIssued(TOKEN)
      observer.onOpened(FILE_ID)
      return Promise.reject(new Error('network'))
    })
    vi.mocked(resumeFile).mockResolvedValue()
    const queue = new UploadQueue(() => target)

    queue.addFiles(SHARE_ID, [file()])
    await vi.waitFor(() => expect(items(queue)[0]?.phase).toBe('failed'))
    queue.resume({ shareId: SHARE_ID, fileId: FILE_ID }, file())

    await vi.waitFor(() =>
      expect(resumeFile).toHaveBeenCalledWith(expect.objectContaining({ fileId: FILE_ID, uploadToken: TOKEN })),
    )
  })

  describe('abandon', () => {
    async function failedQueue(target: UploadTarget) {
      vi.mocked(uploadNewFile).mockImplementation(({ observer }) => {
        observer.onTokenIssued(TOKEN)
        observer.onOpened(FILE_ID)
        return Promise.reject(new Error('network'))
      })
      const queue = new UploadQueue(() => target)
      queue.addFiles(SHARE_ID, [file()])
      await vi.waitFor(() => expect(items(queue)[0]?.phase).toBe('failed'))
      return queue
    }

    it('cancels a failed upload with its token, then removes it and forgets its token', async () => {
      const target = fakeTarget()
      const queue = await failedQueue(target)

      await queue.abandon(items(queue)[0].key)

      expect(target.cancel).toHaveBeenCalledWith({ fileId: FILE_ID, uploadToken: TOKEN })
      expect(items(queue)).toEqual([])
      queue.resume({ shareId: SHARE_ID, fileId: FILE_ID }, file())
      expect(vi.mocked(resumeFile).mock.calls[0][0].uploadToken).toBeUndefined()
    })

    it('keeps the item failed with the reason when the cancel fails', async () => {
      const target = fakeTarget()
      const failure = new Error('storage down')
      vi.mocked(target.cancel).mockRejectedValue(failure)
      const queue = await failedQueue(target)

      await queue.abandon(items(queue)[0].key)

      expect(items(queue)).toHaveLength(1)
      expect(items(queue)[0].phase).toBe('failed')
      expect(items(queue)[0].error).toBeInstanceOf(Error)
    })

    function axiosFailure(status: number): AxiosError {
      const config = { headers: new AxiosHeaders({ 'X-Upload-Token': TOKEN }) }
      const response = { status, data: {}, headers: new AxiosHeaders(), statusText: '', config } as AxiosResponse
      return new AxiosError('failed', undefined, config, undefined, response)
    }

    it('treats a 404 on the cancel as a success: row removed and entry forgotten', async () => {
      rememberUpload({ shareId: SHARE_ID, fileId: FILE_ID, name: 'a', size: 3, lastModified: 1, sha256: 'ab' })
      const target = fakeTarget()
      vi.mocked(target.cancel).mockRejectedValue(axiosFailure(404))
      const queue = await failedQueue(target)

      await queue.abandon(items(queue)[0].key)

      expect(items(queue)).toEqual([])
      expect(recallUpload(FILE_ID)).toBeUndefined()
    })

    it('keeps the row failed with a reduced error on a 500', async () => {
      const target = fakeTarget()
      vi.mocked(target.cancel).mockRejectedValue(axiosFailure(500))
      const queue = await failedQueue(target)

      await queue.abandon(items(queue)[0].key)

      const { error, phase } = items(queue)[0]
      expect(phase).toBe('failed')
      expect(error).toBeInstanceOf(UploadRequestError)
      expect(JSON.stringify(error)).not.toContain(TOKEN)
    })

    it('ignores an item that is not failed or has no file', async () => {
      const target = fakeTarget()
      vi.mocked(uploadNewFile).mockImplementation(untilCanceled)
      const queue = new UploadQueue(() => target)
      queue.addFiles(SHARE_ID, [file()])
      await settled()

      await queue.abandon(items(queue)[0].key)

      expect(target.cancel).not.toHaveBeenCalled()
      expect(items(queue)).toHaveLength(1)
    })
  })

  it('reports a finished upload with its file id and token', async () => {
    const onUploaded = vi.fn()
    vi.mocked(uploadNewFile).mockImplementation(({ observer }) => {
      observer.onTokenIssued(TOKEN)
      observer.onOpened(FILE_ID)
      return Promise.resolve()
    })
    const queue = new UploadQueue(() => fakeTarget(), { onUploaded })

    queue.addFiles(SHARE_ID, [file()])

    await vi.waitFor(() =>
      expect(onUploaded).toHaveBeenCalledWith({
        shareId: SHARE_ID,
        fileId: FILE_ID,
        uploadToken: TOKEN,
        name: 'video.mp4',
        size: 3,
      }),
    )
  })

  it('keeps no request config nor token in the error of a failed upload', async () => {
    const config = { headers: new AxiosHeaders({ 'X-Upload-Token': TOKEN }) }
    const response = {
      status: 413,
      data: { error: 'Too big' },
      headers: new AxiosHeaders({ 'retry-after': '3' }),
      statusText: '',
      config,
    } as AxiosResponse
    const failure = new AxiosError('failed', undefined, config, undefined, response)
    vi.mocked(uploadNewFile).mockImplementation(({ observer }) => {
      observer.onTokenIssued(TOKEN)
      observer.onOpened(FILE_ID)
      return Promise.reject(failure)
    })
    const queue = new UploadQueue(() => fakeTarget())

    queue.addFiles(SHARE_ID, [file()])
    await vi.waitFor(() => expect(items(queue)[0]?.phase).toBe('failed'))

    const { error } = items(queue)[0]
    expect(error).toBeInstanceOf(UploadRequestError)
    expect(Object.keys(error as object).sort()).toEqual(['name', 'retryAfter', 'serverMessage', 'status'])
    expect(JSON.stringify(error)).not.toContain(TOKEN)
    expect(String((error as Error).stack)).not.toContain(TOKEN)
  })
})
