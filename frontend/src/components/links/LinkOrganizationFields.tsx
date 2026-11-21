import { useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { LinkOrganization, LinkTag } from '#api/link-organization'
import { TagPill } from '#components/links/TagPill'
import { Button } from '#components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '#components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import type { UseLinkOrganizationOptions } from '#hooks/useLinkOrganizationOptions'
import { LINK_TAGS_MAX, toggleTagId, type LinkOrganizationValues } from '#schemas/link-organization.schema'

const NO_FOLDER = 'none'

interface LinkOrganizationFieldsProps<T extends FieldValues & LinkOrganizationValues> {
  control: Control<T>
  organization: UseLinkOrganizationOptions
  link?: LinkOrganization
  idPrefix: string
}

export function LinkOrganizationFields<T extends FieldValues & LinkOrganizationValues>({
  control,
  organization,
  link,
  idPrefix,
}: LinkOrganizationFieldsProps<T>) {
  const { t } = useTranslation()
  const { options, reload } = organization
  const tagsField = useController({ control, name: 'tagIds' as Path<T> })
  const folderField = useController({ control, name: 'folderId' as Path<T> })
  const tagIds = tagsField.field.value as string[]
  const folderId = folderField.field.value as string | null
  const loading = options.status === 'loading'

  const tags = useMemo(() => {
    const known = new Map<string, LinkTag>()
    for (const tag of link?.tags ?? []) known.set(tag.id, tag)
    for (const tag of options.tags) known.set(tag.id, tag)
    return known
  }, [link, options.tags])

  const folders = useMemo(() => {
    const items = options.folders.map(({ id, name }) => ({ id, name }))
    if (link?.folder && !items.some((folder) => folder.id === link.folder?.id)) items.push(link.folder)
    return items
  }, [link, options.folders])

  const { field: tagsControl } = tagsField
  const { field: folderControl } = folderField
  const ready = options.status === 'ready'

  useEffect(() => {
    if (!ready) return
    const available = new Set(options.tags.map((tag) => tag.id))
    if (tagIds.some((id) => !available.has(id))) tagsControl.onChange(tagIds.filter((id) => available.has(id)))
    if (folderId !== null && !options.folders.some((folder) => folder.id === folderId)) folderControl.onChange(null)
  }, [ready, options.tags, options.folders, tagIds, folderId, tagsControl, folderControl])

  const selectedTags = tagIds.flatMap((id) => tags.get(id) ?? [])
  const limitReached = tagIds.length >= LINK_TAGS_MAX

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-tags`}>{t('linkOrganization.tags')}</FieldLabel>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              id={`${idPrefix}-tags`}
              type="button"
              variant="outline"
              disabled={loading}
              size="lg"
              className="h-auto min-h-9 justify-between"
            >
              <span className="flex flex-wrap gap-1">
                {selectedTags.length === 0 ? (
                  <span className="text-muted-foreground">{t('linkOrganization.tagsPlaceholder')}</span>
                ) : (
                  selectedTags.map((tag) => <TagPill key={tag.id} tag={tag} />)
                )}
              </span>
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 min-w-56">
            {options.tags.length === 0 && (
              <DropdownMenuCheckboxItem disabled checked={false}>
                {t('linkOrganization.noTags')}
              </DropdownMenuCheckboxItem>
            )}
            {options.tags.map((tag) => {
              const checked = tagIds.includes(tag.id)
              return (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={checked}
                  disabled={!checked && limitReached}
                  onCheckedChange={(next) => tagsField.field.onChange(toggleTagId(tagIds, tag.id, next))}
                  onSelect={(event) => event.preventDefault()}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
                  {tag.name}
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {options.status === 'error' ? (
          <FieldDescription>
            {t('linkOrganization.loadFailed')}{' '}
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm" onClick={reload}>
              {t('linkOrganization.retry')}
            </Button>
          </FieldDescription>
        ) : (
          <FieldDescription>
            {limitReached
              ? t('linkOrganization.tagsMax', { max: LINK_TAGS_MAX })
              : t('linkOrganization.tagsHelp', { max: LINK_TAGS_MAX })}
          </FieldDescription>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-folder`}>{t('linkOrganization.folder')}</FieldLabel>
        <Select
          value={folderId ?? NO_FOLDER}
          onValueChange={(next) => folderField.field.onChange(next === NO_FOLDER ? null : next)}
          disabled={loading}
        >
          <SelectTrigger id={`${idPrefix}-folder`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FOLDER}>{t('linkOrganization.noFolder')}</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  )
}
