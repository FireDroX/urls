import type { LinkTag } from '#api/link-organization'
import { readableTextColor } from '#utils/tag-color'

export function TagPill({ tag }: { tag: LinkTag }) {
  return (
    <span
      className="inline-flex max-w-40 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-white/15"
      style={{ backgroundColor: tag.color, color: readableTextColor(tag.color) }}
    >
      <span className="truncate">{tag.name}</span>
    </span>
  )
}
