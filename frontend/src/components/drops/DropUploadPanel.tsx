import { useMemo, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { cancelDropUpload, type PublicDrop } from '#api/public-drops'
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
import { useUploads } from '#hooks/useUploads'
import { dropUploadErrorMessage } from '#lib/drop-errors'
import type { TurnstileGate } from '#lib/turnstile-gate'
import { isActiveUpload } from '#lib/upload-queue'
import { DROP_UPLOADER_NAME_MAX_LENGTH } from '#schemas/drop.schema'
import { FILE_MAX_SIZE_BYTES } from '#schemas/share.schema'
import { selectWithinRoom, type RefusedFile } from '#utils/drop-capacity'
import { forgetUpload, pendingUploadsOf, type PendingUpload } from '#utils/pending-uploads'

const NOT_FOUND = 404

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
  const [pendingVersion, setPendingVersion] = useState(0)
  const nextRefusalId = useRef(1)

  const active = uploads.items.filter(isActiveUpload)
  const activeBytes = active.reduce((total, item) => total + item.size, 0)
  const filesRemaining = Math.max(0, drop.filesRemaining - active.length)
  const bytesRemaining = Math.max(0, drop.bytesRemaining - activeBytes)

  const stored = useMemo(
    () => pendingUploadsOf(drop.id),
    [drop.id, uploads.revision, uploads.items.length, pendingVersion],
  )
  const queuedFileIds = new Set(uploads.items.map((item) => item.fileId))
  const pending = stored.filter((upload) => !queuedFileIds.has(upload.fileId))

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

  async function abandon({ fileId, uploadToken }: PendingUpload) {
    try {
      await cancelDropUpload(drop.id, { fileId, uploadToken })
    } catch (error) {
      if (!(isAxiosError(error) && error.response?.status === NOT_FOUND)) return
    }
    forgetUpload(fileId)
    setPendingVersion((version) => version + 1)
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
        errorMessage={dropUploadErrorMessage}
      />
      <PendingDropUploads
        uploads={pending}
        onResume={({ fileId }, file) => uploads.resume(fileId, file)}
        onAbandon={(upload) => void abandon(upload)}
      />
      <DropReceiptsList receipts={receipts} />
    </main>
  )
}
