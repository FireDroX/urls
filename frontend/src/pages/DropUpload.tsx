import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { PublicDrop } from '#api/public-drops'
import { DropClosed } from '#components/drops/DropClosed'
import { DropUploadPanel } from '#components/drops/DropUploadPanel'
import { StatusMessage } from '#components/StatusMessage'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { UploadQueueProvider } from '#components/UploadQueueProvider'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useDropReceipts } from '#hooks/useDropReceipts'
import { usePublicDrop } from '#hooks/usePublicDrop'
import { dropUploadTarget } from '#lib/drop-upload-target'
import { TurnstileGate } from '#lib/turnstile-gate'
import type { UploadedFile } from '#lib/upload-queue'
import { NotFound } from '#pages/NotFound'
import { purgeExpiredUploads } from '#utils/pending-uploads'

function DropSkeleton() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Skeleton className="h-96 w-full max-w-xl" />
    </div>
  )
}

function DropPage({
  dropId,
  drop,
  closed,
  refresh,
}: {
  dropId: string
  drop: PublicDrop
  closed: boolean
  refresh: () => void
}) {
  const { t } = useTranslation()
  useDocumentTitle(drop.title ?? t('dropUpload.title'))
  const [uploaderName, setUploaderName] = useState('')
  const [resetKey, setResetKey] = useState(0)
  const nameRef = useRef(uploaderName)
  const { receipts, add } = useDropReceipts(dropId)

  useEffect(() => {
    nameRef.current = uploaderName
  }, [uploaderName])

  const gate = useMemo(
    () =>
      new TurnstileGate({
        required: Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY),
        onConsumed: () => setResetKey((key) => key + 1),
      }),
    [],
  )
  const targetOf = useCallback(
    (id: string) => dropUploadTarget(id, { gate, uploaderName: () => nameRef.current.trim() || null }),
    [gate],
  )
  const onUploaded = useCallback(
    (upload: UploadedFile) => {
      add(upload)
      refresh()
    },
    [add, refresh],
  )

  return (
    <UploadQueueProvider targetOf={targetOf} onUploaded={onUploaded}>
      <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
        <DropUploadPanel
          drop={drop}
          closed={closed}
          receipts={receipts}
          uploaderName={uploaderName}
          onUploaderNameChange={setUploaderName}
          gate={gate}
          resetKey={resetKey}
        />
      </div>
    </UploadQueueProvider>
  )
}

export function DropUpload() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { state, reload, refresh } = usePublicDrop(id)

  useEffect(() => {
    purgeExpiredUploads()
  }, [])

  switch (state.status) {
    case 'loading':
      return <DropSkeleton />
    case 'notFound':
      return <NotFound />
    case 'closed':
      return <DropClosed />
    case 'failed':
      return (
        <StatusMessage title={t('dropUpload.loadFailedTitle')} body={state.message}>
          <Button variant="outline" onClick={reload}>
            {t('dropUpload.retry')}
          </Button>
        </StatusMessage>
      )
    case 'ready':
      return <DropPage dropId={id} drop={state.drop} closed={state.closedWhileOpen} refresh={refresh} />
  }
}
