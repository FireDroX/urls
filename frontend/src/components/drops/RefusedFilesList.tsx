import { TriangleAlertIcon, X } from 'lucide-react'
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
      <ul className="flex flex-col gap-2.5">
        {refused.map(({ id, name, reason }) => (
          <li key={id} className="flex items-center gap-2.5 rounded-[8px] border border-refused-border p-3 text-sm">
            <TriangleAlertIcon className="size-4 shrink-0 text-state-danger" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate" title={name}>
                {name}
              </span>
              <span role="alert" className="block text-xs text-state-danger">
                {t(`dropUpload.refused.${reason}`)}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
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
