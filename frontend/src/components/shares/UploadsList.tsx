import { useRef, type ChangeEvent } from 'react'
import type { TFunction } from 'i18next'
import { FileIcon, RotateCw, TriangleAlertIcon, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { useFileSize } from '#hooks/useFileSize'
import { uploadErrorMessage } from '#lib/share-errors'
import { cn } from '#lib/utils'
import type { UploadItem } from '#lib/upload-queue'
import { currentPartOf } from '#utils/file-parts'

const PERCENT = 100

interface UploadsListProps {
  items: UploadItem[]
  onCancel: (key: string) => void
  onDismiss: (key: string) => void
  onResume?: (fileId: string, file: File) => void
  onAbandon?: (key: string) => void
  errorMessage?: (error: unknown, t: TFunction) => string
}

function ProgressBar({ label, value, max, fillClass }: { label: string; value: number; max: number; fillClass: string }) {
  const percent = Math.min(PERCENT, Math.floor((value / max) * PERCENT))

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={PERCENT}
      aria-valuenow={percent}
      className="h-1.5 overflow-hidden rounded-full bg-bar-track"
    >
      <div className={cn('h-full rounded-full transition-[width]', fillClass)} style={{ width: `${percent}%` }} />
    </div>
  )
}

function UploadRow({
  item,
  onCancel,
  onDismiss,
  onResume,
  onAbandon,
  errorMessage = uploadErrorMessage,
}: { item: UploadItem } & Omit<UploadsListProps, 'items'>) {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const failed = item.phase === 'failed'
  const closable = item.phase !== 'completing' && item.phase !== 'canceling'
  const inputRef = useRef<HTMLInputElement>(null)
  const { fileId } = item

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (selected && fileId) onResume?.(fileId, selected)
  }

  const progressText =
    item.phase === 'uploading' && item.partSize
      ? `${formatSize(item.sentBytes)} / ${formatSize(item.size)} · ${t('shares.upload.part', currentPartOf(item.size, item.partSize, item.sentBytes))}`
      : `${formatSize(item.size)} · ${t(`shares.upload.phase.${item.phase}`)}`

  return (
    <li className={cn('flex flex-col gap-1.5 rounded-lg border p-3', failed && 'border-refused-border')}>
      <div className="flex items-center gap-2.5 text-sm">
        {failed ? (
          <TriangleAlertIcon className="size-4 shrink-0 text-state-danger" aria-hidden />
        ) : (
          <FileIcon className="size-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate" title={item.name}>
          {item.name}
        </span>
        <span className="text-[13px] text-muted-foreground">{progressText}</span>
        {failed && fileId && onResume && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              aria-label={t('dropUpload.pending.resumeInput', { name: item.name })}
              onChange={handleResumeChange}
            />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <RotateCw />
              {t('dropUpload.pending.resume')}
            </Button>
          </>
        )}
        {failed && fileId && onAbandon && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('dropUpload.pending.abandonLabel', { name: item.name })}
            onClick={() => onAbandon(item.key)}
          >
            {t('dropUpload.pending.abandon')}
          </Button>
        )}
        {closable && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              failed
                ? t('shares.upload.dismiss', { name: item.name })
                : t('shares.upload.cancel', { name: item.name })
            }
            title={failed ? undefined : t('shares.upload.cancelHelp')}
            onClick={() => (failed ? onDismiss(item.key) : onCancel(item.key))}
          >
            <X />
          </Button>
        )}
      </div>
      {!failed && item.hashedBytes > 0 && (
        <ProgressBar label={t('shares.upload.hashProgress')} value={item.hashedBytes} max={item.size} fillClass="bg-bar-neutral" />
      )}
      {!failed && item.phase !== 'queued' && item.phase !== 'hashing' && (
        <ProgressBar label={t('shares.upload.sendProgress')} value={item.sentBytes} max={item.size} fillClass="bg-bar" />
      )}
      {failed && (
        <p role="alert" className="text-xs text-state-danger">
          {errorMessage(item.error, t)}
        </p>
      )}
    </li>
  )
}

export function UploadsList({ items, onCancel, onDismiss, onResume, onAbandon, errorMessage }: UploadsListProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return null
  }
  return (
    <ul aria-label={t('shares.upload.region')} className="flex flex-col gap-2.5">
      {items.map((item) => (
        <UploadRow
          key={item.key}
          item={item}
          onCancel={onCancel}
          onDismiss={onDismiss}
          onResume={onResume}
          onAbandon={onAbandon}
          errorMessage={errorMessage}
        />
      ))}
    </ul>
  )
}
