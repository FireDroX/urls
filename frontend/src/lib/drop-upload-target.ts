import {
  announceDropUpload,
  cancelDropUpload,
  completeDropUpload,
  listDropParts,
  uploadDropPart,
} from '#api/public-drops'
import type { TurnstileGate } from '#lib/turnstile-gate'
import type { UploadTarget } from '#lib/upload-target'

interface DropUploadTargetOptions {
  gate: TurnstileGate
  uploaderName: () => string | null
}

export function dropUploadTarget(dropId: string, { gate, uploaderName }: DropUploadTargetOptions): UploadTarget {
  return {
    beforeAnnounce: (signal) => gate.next(signal),
    announce: async (file, proof) => {
      const { fileId, partSize, uploadToken } = await announceDropUpload(dropId, {
        ...file,
        turnstileToken: proof,
        uploaderName: uploaderName(),
      })
      return { fileId, partSize, uploadToken }
    },
    listParts: (handle) => listDropParts(dropId, handle),
    sendPart: (handle, partNumber, body, options) => uploadDropPart(dropId, handle, partNumber, body, options),
    complete: (handle) => completeDropUpload(dropId, handle),
    cancel: (handle) => cancelDropUpload(dropId, handle),
  }
}
