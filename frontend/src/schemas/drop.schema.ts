import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { CreateDropPayload, Drop, UpdateDropPayload } from '#api/drops'
import { expiresAtField, slugField } from '#schemas/link.schema'
import { fromDateTimeLocal, toDateTimeLocal } from '#utils/datetime-local'

export const DROP_TITLE_MAX_LENGTH = 120
export const DROP_UPLOADER_NAME_MAX_LENGTH = 80
export const DROP_MAX_FILES_LIMIT = 50
export const DROP_MAX_TOTAL_BYTES = 75 * 1024 ** 3
const DEFAULT_MAX_FILES = 10
const DEFAULT_EXPIRY_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const MIB = 1024 ** 2
const GIB = 1024 ** 3
const POSITIVE_INTEGER_REGEX = /^[1-9][0-9]*$/
const CONTROL_CHARACTERS = /\p{Cc}/u

export const DROP_SIZE_UNITS = ['MiB', 'GiB'] as const
export type DropSizeUnit = (typeof DROP_SIZE_UNITS)[number]

const UNIT_BYTES: Record<DropSizeUnit, number> = { MiB: MIB, GiB: GIB }

export function createDropFormSchema(t: TFunction, drop?: Drop) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .max(DROP_TITLE_MAX_LENGTH, t('drops.validation.titleTooLong', { max: DROP_TITLE_MAX_LENGTH }))
        .refine((value) => !CONTROL_CHARACTERS.test(value), t('drops.validation.titleCharacters')),
      slug: slugField(t, drop === undefined),
      maxFiles: z
        .string()
        .trim()
        .refine(
          (value) => POSITIVE_INTEGER_REGEX.test(value) && Number(value) <= DROP_MAX_FILES_LIMIT,
          t('drops.validation.maxFiles', { max: DROP_MAX_FILES_LIMIT }),
        ),
      maxTotalSize: z
        .string()
        .trim()
        .refine((value) => POSITIVE_INTEGER_REGEX.test(value), t('drops.validation.maxTotalSize')),
      maxTotalUnit: z.enum(DROP_SIZE_UNITS),
      expiresAt: expiresAtField(t, toDateTimeLocal(drop?.expiresAt ?? null)),
    })
    .superRefine((values, context) => {
      if (POSITIVE_INTEGER_REGEX.test(values.maxTotalSize) && totalBytes(values) > DROP_MAX_TOTAL_BYTES) {
        context.addIssue({
          code: 'custom',
          path: ['maxTotalSize'],
          message: t('drops.validation.maxTotalSizeTooLarge', { max: DROP_MAX_TOTAL_BYTES / GIB }),
        })
      }
    })
}

export type DropFormValues = z.infer<ReturnType<typeof createDropFormSchema>>

function totalBytes(values: Pick<DropFormValues, 'maxTotalSize' | 'maxTotalUnit'>): number {
  return Number(values.maxTotalSize) * UNIT_BYTES[values.maxTotalUnit]
}

function sizeFields(bytes: number): Pick<DropFormValues, 'maxTotalSize' | 'maxTotalUnit'> {
  if (bytes % GIB === 0) return { maxTotalSize: String(bytes / GIB), maxTotalUnit: 'GiB' }
  return { maxTotalSize: String(Math.ceil(bytes / MIB)), maxTotalUnit: 'MiB' }
}

export function dropFormDefaults(drop?: Drop, now = new Date()): DropFormValues {
  if (!drop) {
    return {
      title: '',
      slug: '',
      maxFiles: String(DEFAULT_MAX_FILES),
      ...sizeFields(GIB),
      expiresAt: toDateTimeLocal(new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * DAY_MS).toISOString()),
    }
  }
  return {
    title: drop.title ?? '',
    slug: drop.id,
    maxFiles: String(drop.maxFiles),
    ...sizeFields(drop.maxTotalBytes),
    expiresAt: toDateTimeLocal(drop.expiresAt),
  }
}

export function toCreateDropPayload(values: DropFormValues): CreateDropPayload {
  const payload: CreateDropPayload = { maxFiles: Number(values.maxFiles), maxTotalBytes: totalBytes(values) }
  if (values.slug !== '') payload.slug = values.slug
  if (values.title !== '') payload.title = values.title
  if (values.expiresAt !== '') payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  return payload
}

export function toUpdateDropPayload(drop: Drop, values: DropFormValues): UpdateDropPayload {
  const initial = dropFormDefaults(drop)
  const payload: UpdateDropPayload = {}
  if (values.title !== initial.title) payload.title = values.title === '' ? null : values.title
  if (values.slug !== initial.slug) payload.slug = values.slug
  if (values.maxFiles !== initial.maxFiles) payload.maxFiles = Number(values.maxFiles)
  if (totalBytes(values) !== totalBytes(initial)) payload.maxTotalBytes = totalBytes(values)
  if (values.expiresAt !== initial.expiresAt) payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  return payload
}
