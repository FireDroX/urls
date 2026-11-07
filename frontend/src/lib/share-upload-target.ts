import { completeFileUpload, deleteShareFile, listFileParts, startFileUpload, uploadFilePart } from '#api/shares'
import type { UploadTarget } from '#lib/upload-target'

export function shareUploadTarget(shareId: string): UploadTarget {
  return {
    announce: (file) => startFileUpload(shareId, file),
    listParts: ({ fileId }) => listFileParts(shareId, fileId),
    sendPart: ({ fileId }, partNumber, body, options) => uploadFilePart(shareId, fileId, partNumber, body, options),
    complete: ({ fileId }) => completeFileUpload(shareId, fileId),
    cancel: ({ fileId }) => deleteShareFile(shareId, fileId),
  }
}
