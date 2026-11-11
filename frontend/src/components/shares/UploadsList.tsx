import type { TFunction } from 'i18next'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FormError } from '#components/FormError'
import { Button } from '#components/ui/button'
import { useFileSize } from '#hooks/useFileSize'
import { uploadErrorMessage } from '#lib/share-errors'
import type { UploadItem } from '#lib/upload-queue'

const PERCENT = 100

interface UploadsListProps {
  items: UploadItem[]
  onCancel: (key: string) => void
  onDismiss: (key: string) => void
  errorMessage?: (error: unknown, t: TFunction) => string
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const { t } = useTranslation()
  const percent = Math.min(PERCENT, Math.floor((value / max) * PERCENT))

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{t('shares.upload.percent', { percent })}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function UploadRow({
  item,
  onCancel,
  onDismiss,
  errorMessage = uploadErrorMessage,
}: { item: UploadItem } & Omit<UploadsListProps, 'items'>) {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const failed = item.phase === 'failed'
  const closable = item.phase !== 'completing' && item.phase !== 'canceling'

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatSize(item.size)} · {t(`shares.upload.phase.${item.phase}`)}
          </p>
        </div>
        {closable && (
          <Button
            variant="ghost"
            size="icon-sm"
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
        <ProgressBar label={t('shares.upload.hashProgress')} value={item.hashedBytes} max={item.size} />
      )}
      {!failed && item.phase !== 'queued' && item.phase !== 'hashing' && (
        <ProgressBar label={t('shares.upload.sendProgress')} value={item.sentBytes} max={item.size} />
      )}
      {failed && <FormError message={errorMessage(item.error, t)} />}
    </li>
  )
}

export function UploadsList({ items, onCancel, onDismiss, errorMessage }: UploadsListProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return null
  }
  return (
    <ul
      aria-label={t('shares.upload.region')}
      className="divide-y divide-border rounded-xl border border-border bg-card"
    >
      {items.map((item) => (
        <UploadRow key={item.key} item={item} onCancel={onCancel} onDismiss={onDismiss} errorMessage={errorMessage} />
      ))}
    </ul>
  )
}
