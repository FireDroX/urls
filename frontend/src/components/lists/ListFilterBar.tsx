import { useTranslation } from 'react-i18next'
import { LIST_FOLDER_NONE, LIST_SORTS, type ListSort } from '#api/list-params'
import type { LinkFolder, LinkTag } from '#api/link-organization'
import { ListSearchInput } from '#components/lists/ListSearchInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import type { ListFilters, ListView } from '#utils/list-view'

const ALL = 'all'

interface FilterSelectProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}

function FilterSelect({ label, value, onValueChange, options }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={label} className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface ListFilterBarProps {
  view: ListView
  states: { value: string; label: string }[]
  healths?: { value: string; label: string }[]
  types?: { value: string; label: string }[]
  tags: LinkTag[]
  folders: LinkFolder[]
  searchPlaceholder: string
  onChange: (patch: ListFilters) => void
}

export function ListFilterBar({
  view,
  states,
  types,
  healths,
  tags,
  folders,
  searchPlaceholder,
  onChange,
}: ListFilterBarProps) {
  const { t } = useTranslation()
  const orNull = (value: string) => (value === ALL ? null : value)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListSearchInput value={view.q} placeholder={searchPlaceholder} onChange={(q) => onChange({ q })} />
      <FilterSelect
        label={t('listFilters.tag')}
        value={view.tag ?? ALL}
        onValueChange={(value) => onChange({ tag: orNull(value) })}
        options={[
          { value: ALL, label: t('listFilters.allTags') },
          ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
        ]}
      />
      <FilterSelect
        label={t('listFilters.folder')}
        value={view.folder ?? ALL}
        onValueChange={(value) => onChange({ folder: orNull(value) })}
        options={[
          { value: ALL, label: t('listFilters.allFolders') },
          { value: LIST_FOLDER_NONE, label: t('listFilters.noFolder') },
          ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
        ]}
      />
      {types && (
        <FilterSelect
          label={t('listFilters.type')}
          value={view.type ?? ALL}
          onValueChange={(value) => onChange({ type: orNull(value) })}
          options={[{ value: ALL, label: t('listFilters.allTypes') }, ...types]}
        />
      )}
      <FilterSelect
        label={t('listFilters.state')}
        value={view.state ?? ALL}
        onValueChange={(value) => onChange({ state: orNull(value) })}
        options={[{ value: ALL, label: t('listFilters.allStates') }, ...states]}
      />
      {healths && (
        <FilterSelect
          label={t('listFilters.health.label')}
          value={view.health ?? ALL}
          onValueChange={(value) => onChange({ health: orNull(value) })}
          options={[{ value: ALL, label: t('listFilters.health.all') }, ...healths]}
        />
      )}
      <FilterSelect
        label={t('listFilters.sort')}
        value={view.sort}
        onValueChange={(value) => onChange({ sort: value as ListSort })}
        options={LIST_SORTS.map((sort) => ({ value: sort, label: t(`listFilters.sorts.${sort}`) }))}
      />
    </div>
  )
}
