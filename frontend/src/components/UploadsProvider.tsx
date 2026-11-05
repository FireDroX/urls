import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { UploadsContext } from '#hooks/useUploads'
import { isActiveUpload, UploadQueue } from '#lib/upload-queue'

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  event.preventDefault()
}

export function UploadsProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(() => new UploadQueue())
  const { items } = useSyncExternalStore(queue.subscribe, queue.getSnapshot)
  const uploading = items.some(isActiveUpload)

  useEffect(() => () => queue.stop(), [queue])

  useEffect(() => {
    if (!uploading) {
      return
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [uploading])

  return <UploadsContext.Provider value={queue}>{children}</UploadsContext.Provider>
}
