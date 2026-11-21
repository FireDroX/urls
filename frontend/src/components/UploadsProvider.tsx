import type { ReactNode } from 'react'
import { UploadQueueProvider } from '#components/UploadQueueProvider'
import { shareUploadTarget } from '#lib/share-upload-target'

export function UploadsProvider({ children }: { children: ReactNode }) {
  return <UploadQueueProvider targetOf={shareUploadTarget}>{children}</UploadQueueProvider>
}
