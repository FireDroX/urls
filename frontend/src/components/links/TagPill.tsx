import { useTranslation } from 'react-i18next'
import type { LinkTag } from '#api/link-organization'
import { readableTextColor } from '#utils/tag-color'

const PILL_CLASS =
  'inline-flex max-w-40 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-white/15'

interface TagPillProps {
  tag: LinkTag
  onSelect?: (tag: LinkTag) => void
}

export function TagPill({ tag, onSelect }: TagPillProps) {
  const { t } = useTranslation()
  const style = { backgroundColor: tag.color, color: readableTextColor(tag.color) }

  if (!onSelect) {
    return (
      <span className={PILL_CLASS} style={style}>
        <span className="truncate">{tag.name}</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      className={`${PILL_CLASS} cursor-pointer hover:ring-white/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
      style={style}
      aria-label={t('listFilters.filterByTag', { name: tag.name })}
      onClick={() => onSelect(tag)}
    >
      <span className="truncate">{tag.name}</span>
    </button>
  )
}
