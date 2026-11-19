import { useState, type ChangeEvent, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { IconTile } from '#components/IconTile'
import { cn } from '#lib/utils'

interface FileDropZoneProps {
  onFiles: (files: File[]) => void
  help?: string
  disabled?: boolean
}

export function FileDropZone({ onFiles, help, disabled = false }: FileDropZoneProps) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    if (!disabled) setDragging(true)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) onFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <label
      className={cn(
        'flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-drop-zone-border bg-drop-zone-bg p-5 text-center transition-colors focus-within:border-link-accent hover:border-link-accent',
        dragging && 'border-link-accent bg-state-expired-bg',
        disabled && 'cursor-not-allowed opacity-60 hover:border-drop-zone-border',
      )}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <IconTile icon={Upload} />
      <span className="font-semibold">{t('shares.upload.dropTitle')}</span>
      <span className="text-[13px] text-muted-foreground">
        <Trans
          i18nKey="shares.upload.dropBrowse"
          components={{ browse: <span className="text-link-accent underline" /> }}
        />
        {' · '}
        {help ?? t('shares.upload.dropHelp')}
      </span>
      <input type="file" multiple disabled={disabled} className="sr-only" onChange={handleChange} />
    </label>
  )
}
