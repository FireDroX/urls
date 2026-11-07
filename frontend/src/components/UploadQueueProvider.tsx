import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { UploadsContext } from '#hooks/useUploads'
import { isActiveUpload, UploadQueue } from '#lib/upload-queue'
import type { UploadTargetResolver } from '#lib/upload-target'

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  event.preventDefault()
}

export function UploadQueueProvider({ targetOf, children }: { targetOf: UploadTargetResolver; children: ReactNode }) {
  const [queue] = useState(() => new UploadQueue(targetOf))
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
