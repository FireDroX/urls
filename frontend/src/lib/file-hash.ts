import { FileHashError, UploadCanceledError } from '#lib/share-errors'

type HashMessage = { type: 'progress'; hashedBytes: number } | { type: 'done'; sha256: string } | { type: 'failed' }

export function hashFile(file: Blob, onProgress: (hashedBytes: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new UploadCanceledError())
      return
    }
    const worker = new Worker(new URL('./sha256.worker.ts', import.meta.url), { type: 'module' })

    function release() {
      worker.terminate()
      signal.removeEventListener('abort', cancel)
    }
    function cancel() {
      release()
      reject(new UploadCanceledError())
    }
    function fail() {
      release()
      reject(new FileHashError())
    }

    signal.addEventListener('abort', cancel, { once: true })
    worker.onerror = fail
    worker.onmessage = ({ data }: MessageEvent<HashMessage>) => {
      if (data.type === 'progress') {
        onProgress(data.hashedBytes)
      } else if (data.type === 'done') {
        release()
        resolve(data.sha256)
      } else {
        fail()
      }
    }
    worker.postMessage(file)
  })
}
