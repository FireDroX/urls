import { Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { LinkFolder, LinkOrganization, LinkTag } from '#api/link-organization'
import { TagPill } from '#components/links/TagPill'
import { cn } from '#lib/utils'

export interface OrganizationSelection {
  onTagSelect?: (tag: LinkTag) => void
  onFolderSelect?: (folder: LinkFolder) => void
}

interface LinkOrganizationSummaryProps extends LinkOrganization, OrganizationSelection {
  className?: string
}

export function LinkOrganizationSummary({
  tags,
  folder,
  className,
  onTagSelect,
  onFolderSelect,
}: LinkOrganizationSummaryProps) {
  const { t } = useTranslation()
  if (tags.length === 0 && !folder) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {folder && onFolderSelect && (
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={t('listFilters.filterByFolder', { name: folder.name })}
          onClick={() => onFolderSelect(folder)}
        >
          <Folder className="size-3.5" aria-hidden />
          {folder.name}
        </button>
      )}
      {folder && !onFolderSelect && (
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
              <TagPill tag={tag} onSelect={onTagSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
