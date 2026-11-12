import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicDrop } from '#api/public-drops'
import { DropHeader } from '#components/drops/DropHeader'
import { DropReceiptsList } from '#components/drops/DropReceiptsList'
import { PendingDropUploads } from '#components/drops/PendingDropUploads'
import { RefusedFilesList } from '#components/drops/RefusedFilesList'
import { FileDropZone } from '#components/shares/FileDropZone'
import { UploadsList } from '#components/shares/UploadsList'
import { TurnstileWidget } from '#components/Turnstile'
import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'
import type { DropReceipt } from '#hooks/useDropReceipts'
import { useFileSize } from '#hooks/useFileSize'
import { usePendingDropUploads } from '#hooks/usePendingDropUploads'
import { useUploads } from '#hooks/useUploads'
import { dropUploadErrorMessage } from '#lib/drop-errors'
import type { TurnstileGate } from '#lib/turnstile-gate'
import { isActiveUpload } from '#lib/upload-queue'
import { DROP_UPLOADER_NAME_MAX_LENGTH } from '#schemas/drop.schema'
import { FILE_MAX_SIZE_BYTES } from '#schemas/share.schema'
import { knownFileIds, remainingRoom, selectWithinRoom, type RefusedFile } from '#utils/drop-capacity'
import { pendingUploadsOf } from '#utils/pending-uploads'

interface DropUploadPanelProps {
  drop: PublicDrop
  closed: boolean
  receipts: DropReceipt[]
  uploaderName: string
  onUploaderNameChange: (name: string) => void
  gate: TurnstileGate
  resetKey: number
}

export function DropUploadPanel({
  drop,
  closed,
  receipts,
  uploaderName,
  onUploaderNameChange,
  gate,
  resetKey,
}: DropUploadPanelProps) {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const uploads = useUploads(drop.id)
  const [refused, setRefused] = useState<RefusedFile[]>([])
  const nextRefusalId = useRef(1)

  const [counted, setCounted] = useState(() => ({
    drop,
    fileIds: knownFileIds(uploads.items, pendingUploadsOf(drop.id)),
  }))
  if (counted.drop !== drop) {
    setCounted({ drop, fileIds: knownFileIds(uploads.items, pendingUploadsOf(drop.id)) })
  }

  const active = uploads.items.filter(isActiveUpload)
  const { filesRemaining, bytesRemaining } = remainingRoom(drop, active, counted.fileIds)

  const pending = usePendingDropUploads(drop.id, uploads)

  function addFiles(files: File[]) {
    const selection = selectWithinRoom(files, {
      closed,
      maxFileSize: FILE_MAX_SIZE_BYTES,
      filesRemaining,
      bytesRemaining,
    })
    if (selection.refused.length > 0) {
      const newRefusals = selection.refused.map((refusal) => ({ ...refusal, id: nextRefusalId.current++ }))
      setRefused((current) => [...current, ...newRefusals])
    }
    if (selection.accepted.length > 0) {
      uploads.addFiles(selection.accepted)
    }
  }

  return (
    <main className="flex w-full max-w-xl flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm">
      <DropHeader drop={drop} />
      {closed && (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          {t('dropUpload.closedInline')}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="drop-uploader-name">{t('dropUpload.nameLabel')}</Label>
        <Input
          id="drop-uploader-name"
          value={uploaderName}
          maxLength={DROP_UPLOADER_NAME_MAX_LENGTH}
          placeholder={t('dropUpload.namePlaceholder')}
          onChange={(event) => onUploaderNameChange(event.target.value)}
        />
      </div>
      <FileDropZone
        onFiles={addFiles}
        disabled={closed}
        help={t('dropUpload.dropHelp', { size: formatSize(bytesRemaining) })}
      />
      <div className="flex flex-col gap-2">
        <TurnstileWidget onVerify={(token) => gate.provide(token)} onExpire={() => gate.expire()} resetKey={resetKey} />
        <p className="text-sm text-muted-foreground">{t('dropUpload.verifyHint')}</p>
      </div>
      <RefusedFilesList
        refused={refused}
        onDismiss={(id) => setRefused((current) => current.filter((entry) => entry.id !== id))}
      />
      <UploadsList
        items={uploads.items}
        onCancel={uploads.cancel}
        onDismiss={uploads.dismiss}
        onResume={uploads.resume}
        onAbandon={uploads.abandon}
        errorMessage={dropUploadErrorMessage}
      />
      <PendingDropUploads
        uploads={pending.pending}
        errors={pending.errors}
        errorMessage={dropUploadErrorMessage}
        onResume={({ fileId }, file) => uploads.resume(fileId, file)}
        onAbandon={(upload) => void pending.abandon(upload)}
      />
      <DropReceiptsList receipts={receipts} />
    </main>
  )
}
