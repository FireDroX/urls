import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { LinkTag } from '#api/link-organization'
import { cn } from '#lib/utils'

const PILL_CLASS =
  'inline-flex max-w-40 items-center gap-1.5 rounded-full border border-badge-border px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-foreground dark:text-(--tag-color)'

interface TagPillProps {
  tag: LinkTag
  onSelect?: (tag: LinkTag) => void
  className?: string
}

function TagLabel({ tag }: { tag: LinkTag }) {
  return (
    <>
      <span className="size-1.5 shrink-0 rounded-full bg-(--tag-color)" aria-hidden="true" />
      <span className="truncate">{tag.name}</span>
    </>
  )
}

export function TagPill({ tag, onSelect, className }: TagPillProps) {
  const { t } = useTranslation()
  const style = { '--tag-color': tag.color } as CSSProperties

  if (!onSelect) {
    return (
      <span className={cn(PILL_CLASS, className)} style={style}>
        <TagLabel tag={tag} />
      </span>
    )
  }
  return (
    <button
      type="button"
      className={cn(
        PILL_CLASS,
        'cursor-pointer hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
      style={style}
      aria-label={t('listFilters.filterByTag', { name: tag.name })}
      onClick={() => onSelect(tag)}
    >
      <TagLabel tag={tag} />
    </button>
  )
}
