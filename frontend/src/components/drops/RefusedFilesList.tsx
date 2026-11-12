import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import type { RefusedFile } from '#utils/drop-capacity'

interface RefusedFilesListProps {
  refused: RefusedFile[]
  onDismiss: (id: number) => void
}

export function RefusedFilesList({ refused, onDismiss }: RefusedFilesListProps) {
  const { t } = useTranslation()

  if (refused.length === 0) {
    return null
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="drop-refused-title">
      <h2 id="drop-refused-title" className="text-sm font-semibold">
        {t('dropUpload.refused.title')}
      </h2>
      <ul className="divide-y divide-border rounded-xl border border-destructive/40 bg-card">
        {refused.map(({ id, name, reason }) => (
          <li key={id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={name}>
                {name}
              </p>
              <p role="alert" className="text-xs text-destructive">
                {t(`dropUpload.refused.${reason}`)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('dropUpload.refused.dismiss', { name })}
              onClick={() => onDismiss(id)}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
