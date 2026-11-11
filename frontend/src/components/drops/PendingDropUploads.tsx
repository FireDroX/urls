import type { TFunction } from 'i18next'
import { useRef, type ChangeEvent } from 'react'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FormError } from '#components/FormError'
import { Button } from '#components/ui/button'
import { useFileSize } from '#hooks/useFileSize'
import type { PendingUpload } from '#utils/pending-uploads'

interface PendingDropUploadsProps {
  uploads: PendingUpload[]
  errors: Record<string, unknown>
  errorMessage: (error: unknown, t: TFunction) => string
  onResume: (upload: PendingUpload, file: File) => void
  onAbandon: (upload: PendingUpload) => void
}

function PendingRow({
  upload,
  error,
  errorMessage,
  onResume,
  onAbandon,
}: { upload: PendingUpload; error: unknown } & Omit<PendingDropUploadsProps, 'uploads' | 'errors'>) {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (selected) onResume(upload, selected)
  }

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={upload.name}>
          {upload.name}
        </p>
        <p className="text-xs text-muted-foreground">{formatSize(upload.size)}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label={t('dropUpload.pending.resumeInput', { name: upload.name })}
        onChange={handleChange}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <RotateCw />
        {t('dropUpload.pending.resume')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('dropUpload.pending.abandonLabel', { name: upload.name })}
        onClick={() => onAbandon(upload)}
      >
        {t('dropUpload.pending.abandon')}
      </Button>
      </div>
      {error !== undefined && <FormError message={errorMessage(error, t)} />}
    </li>
  )
}

export function PendingDropUploads({ uploads, errors, errorMessage, onResume, onAbandon }: PendingDropUploadsProps) {
  const { t } = useTranslation()

  if (uploads.length === 0) {
    return null
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="drop-pending-title">
      <h2 id="drop-pending-title" className="text-sm font-semibold">
        {t('dropUpload.pending.title')}
      </h2>
      <p className="text-xs text-muted-foreground">{t('dropUpload.pending.help')}</p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {uploads.map((upload) => (
          <PendingRow
            key={upload.fileId}
            upload={upload}
            error={errors[upload.fileId]}
            errorMessage={errorMessage}
            onResume={onResume}
            onAbandon={onAbandon}
          />
        ))}
      </ul>
    </section>
  )
}
