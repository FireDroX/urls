import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { describe, expect, it, vi } from 'vitest'
import { SHA256_CHUNK_BYTES, sha256OfBlob } from './file-sha256'

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

function chunkedBlob(size: number) {
  const reads: number[] = []
  const blob = {
    size,
    arrayBuffer: () => Promise.reject(new Error('the whole file must never be read')),
    slice: (start: number, end: number) => {
      reads.push(end - start)
      return { arrayBuffer: () => Promise.resolve(new Uint8Array(end - start).fill(1).buffer) }
    },
  }
  return { blob: blob as unknown as Blob, reads }
}

describe('sha256OfBlob', () => {
  it('matches the SHA-256 test vectors', async () => {
    await expect(sha256OfBlob(new Blob(['abc']), () => {})).resolves.toBe(ABC_SHA256)
    await expect(sha256OfBlob(new Blob([]), () => {})).resolves.toBe(EMPTY_SHA256)
  })

  it('reads the file in bounded slices and never as a whole', async () => {
    const size = 2 * SHA256_CHUNK_BYTES + 3
    const { blob, reads } = chunkedBlob(size)

    const digest = await sha256OfBlob(blob, () => {})

    expect(reads).toEqual([SHA256_CHUNK_BYTES, SHA256_CHUNK_BYTES, 3])
    expect(digest).toBe(bytesToHex(sha256(new Uint8Array(size).fill(1))))
  })

  it('reports the hashed bytes after each slice', async () => {
    const onProgress = vi.fn()
    const { blob } = chunkedBlob(SHA256_CHUNK_BYTES + 3)

    await sha256OfBlob(blob, onProgress)

    expect(onProgress.mock.calls).toEqual([[SHA256_CHUNK_BYTES], [SHA256_CHUNK_BYTES + 3]])
  })
})
