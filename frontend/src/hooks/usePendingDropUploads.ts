import { useCallback, useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { cancelDropUpload } from '#api/public-drops'
import type { UseUploads } from '#hooks/useUploads'
import { toUploadError } from '#lib/upload-error'
import { forgetUpload, pendingUploadsOf, type PendingUpload } from '#utils/pending-uploads'

const NOT_FOUND = 404

export function usePendingDropUploads(dropId: string, uploads: UseUploads) {
  const [version, setVersion] = useState(0)
  const [errors, setErrors] = useState<Record<string, unknown>>({})

  const stored = useMemo(
    () => pendingUploadsOf(dropId),
    [dropId, uploads.revision, uploads.items.length, version],
  )
  const queuedFileIds = new Set(uploads.items.map((item) => item.fileId))
  const pending = stored.filter((upload) => !queuedFileIds.has(upload.fileId))

  const abandon = useCallback(
    async ({ fileId, uploadToken }: PendingUpload) => {
      try {
        await cancelDropUpload(dropId, { fileId, uploadToken })
      } catch (error) {
        if (!(isAxiosError(error) && error.response?.status === NOT_FOUND)) {
          setErrors((current) => ({ ...current, [fileId]: toUploadError(error) }))
          return
        }
      }
      forgetUpload(fileId)
      setErrors(({ [fileId]: _removed, ...rest }) => rest)
      setVersion((value) => value + 1)
    },
    [dropId],
  )

  return { pending, errors, abandon }
}
