import { sha256OfBlob } from '#utils/file-sha256'

self.onmessage = (event: MessageEvent<Blob>) => {
  sha256OfBlob(event.data, (hashedBytes) => self.postMessage({ type: 'progress', hashedBytes }))
    .then((sha256) => self.postMessage({ type: 'done', sha256 }))
    .catch(() => self.postMessage({ type: 'failed' }))
}
