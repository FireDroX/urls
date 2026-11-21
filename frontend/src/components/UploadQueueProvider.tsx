import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { UploadsContext } from '#hooks/useUploads'
import { isActiveUpload, UploadQueue, type UploadedFile } from '#lib/upload-queue'
import type { UploadTargetResolver } from '#lib/upload-target'

function warnBeforeLeaving(event: BeforeUnloadEvent) {
  event.preventDefault()
}

interface UploadQueueProviderProps {
  targetOf: UploadTargetResolver
  onUploaded?: (upload: UploadedFile) => void
  children: ReactNode
}

export function UploadQueueProvider({ targetOf, onUploaded, children }: UploadQueueProviderProps) {
  const onUploadedRef = useRef(onUploaded)
  useEffect(() => {
    onUploadedRef.current = onUploaded
  })
  const [queue] = useState(() => new UploadQueue(targetOf, { onUploaded: (upload) => onUploadedRef.current?.(upload) }))
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
