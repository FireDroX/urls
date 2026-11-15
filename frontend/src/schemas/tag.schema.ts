import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { CreateTagPayload, Tag, UpdateTagPayload } from '#api/tags'

export const TAG_NAME_MAX_LENGTH = 50
export const TAG_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
export const DEFAULT_TAG_COLOR = '#6b7280'
const CONTROL_CHARACTERS = /\p{Cc}/u

export function createTagFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('organization.tags.validation.nameRequired'))
      .max(TAG_NAME_MAX_LENGTH, t('organization.tags.validation.nameTooLong', { max: TAG_NAME_MAX_LENGTH }))
      .refine((value) => !CONTROL_CHARACTERS.test(value), t('organization.tags.validation.nameCharacters')),
    color: z.string().regex(TAG_COLOR_PATTERN, t('organization.tags.validation.color')),
  })
}

export type TagFormValues = z.infer<ReturnType<typeof createTagFormSchema>>

export function tagFormDefaults(tag?: Tag): TagFormValues {
  return { name: tag?.name ?? '', color: tag?.color ?? DEFAULT_TAG_COLOR }
}

export function toCreateTagPayload(values: TagFormValues): CreateTagPayload {
  return { name: values.name, color: values.color.toLowerCase() }
}

export function toUpdateTagPayload(tag: Tag, values: TagFormValues): UpdateTagPayload {
  const payload: UpdateTagPayload = {}
  if (values.name !== tag.name) payload.name = values.name
  if (values.color.toLowerCase() !== tag.color.toLowerCase()) payload.color = values.color.toLowerCase()
  return payload
}
