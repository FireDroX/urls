import { Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LinkOrganization } from '#api/link-organization'
import { TagPill } from '#components/links/TagPill'
import { cn } from '#lib/utils'

interface LinkOrganizationSummaryProps extends LinkOrganization {
  className?: string
}

export function LinkOrganizationSummary({ tags, folder, className }: LinkOrganizationSummaryProps) {
  const { t } = useTranslation()
  if (tags.length === 0 && !folder) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {folder && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Folder className="size-3.5" aria-hidden />
          <span className="sr-only">{t('linkOrganization.folderLabel')}</span>
          {folder.name}
        </span>
      )}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label={t('linkOrganization.tagsLabel')}>
          {tags.map((tag) => (
            <li key={tag.id}>
              <TagPill tag={tag} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
