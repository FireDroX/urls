import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { isActiveUpload, type UploadItem, type UploadQueue } from '#lib/upload-queue'

export const UploadsContext = createContext<UploadQueue | null>(null)

export interface UseUploads {
  items: UploadItem[]
  revision: number
  hasActiveUploads: boolean
  addFiles: (files: readonly File[]) => void
  resume: (fileId: string, file: File) => void
  cancel: (key: string) => void
  dismiss: (key: string) => void
}

export function useUploads(shareId: string): UseUploads {
  const queue = useContext(UploadsContext)
  if (!queue) {
    throw new Error('useUploads must be used within an UploadsProvider')
  }
  const { items: allItems, revision } = useSyncExternalStore(queue.subscribe, queue.getSnapshot)

  return useMemo(() => {
    const items = allItems.filter((item) => item.shareId === shareId)
    return {
      items,
      revision,
      hasActiveUploads: items.some(isActiveUpload),
      addFiles: (files) => queue.addFiles(shareId, files),
      resume: (fileId, file) => queue.resume({ shareId, fileId }, file),
      cancel: (key) => queue.cancel(key),
      dismiss: (key) => queue.dismiss(key),
    }
  }, [allItems, revision, queue, shareId])
}
