import { useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'

export function FileDropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(true)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    onFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center transition-colors hover:border-primary focus-within:border-primary',
        dragging && 'border-primary bg-accent',
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-medium">{t('shares.upload.dropTitle')}</span>
      <span className="text-xs text-muted-foreground">{t('shares.upload.dropHelp')}</span>
      <input type="file" multiple className="sr-only" onChange={handleChange} />
    </label>
  )
}
