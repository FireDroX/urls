import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

export const SHA256_CHUNK_BYTES = 8 * 1024 ** 2

export async function sha256OfBlob(blob: Blob, onProgress: (hashedBytes: number) => void): Promise<string> {
  const hash = sha256.create()
  for (let start = 0; start < blob.size; start += SHA256_CHUNK_BYTES) {
    const end = Math.min(start + SHA256_CHUNK_BYTES, blob.size)
    hash.update(new Uint8Array(await blob.slice(start, end).arrayBuffer()))
    onProgress(end)
  }
  return bytesToHex(hash.digest())
}
