import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { CreateSharePayload, Share, UpdateSharePayload } from '#api/shares'
import { expiresAtField, slugField } from '#schemas/link.schema'
import { fromDateTimeLocal, toDateTimeLocal } from '#utils/datetime-local'

export const SHARE_MAX_DOWNLOADS_LIMIT = 1_000_000
export const FILE_MAX_SIZE_BYTES = 20 * 1024 ** 3
const FILE_MIN_SIZE_BYTES = 1
const FILE_NAME_MAX_LENGTH = 255
const POSITIVE_INTEGER_REGEX = /^[1-9][0-9]*$/

function isValidMaxDownloads(value: string): boolean {
  return value === '' || (POSITIVE_INTEGER_REGEX.test(value) && Number(value) <= SHARE_MAX_DOWNLOADS_LIMIT)
}

export function maxDownloadsField(t: TFunction) {
  return z
    .string()
    .trim()
    .refine(isValidMaxDownloads, t('shares.validation.maxDownloads', { max: SHARE_MAX_DOWNLOADS_LIMIT }))
}

export function createShareFormSchema(t: TFunction, share?: Share) {
  return z.object({
    slug: slugField(t, share === undefined),
    expiresAt: expiresAtField(t, toDateTimeLocal(share?.expiresAt ?? null)),
    maxDownloads: maxDownloadsField(t),
    disabled: z.boolean(),
  })
}

export type ShareFormValues = z.infer<ReturnType<typeof createShareFormSchema>>

export function shareFormDefaults(share?: Share): ShareFormValues {
  return {
    slug: share?.id ?? '',
    expiresAt: toDateTimeLocal(share?.expiresAt ?? null),
    maxDownloads: String(share?.maxDownloads ?? ''),
    disabled: share?.disabled ?? false,
  }
}

function toMaxDownloads(value: string): number | null {
  return value === '' ? null : Number(value)
}

export function toCreateSharePayload(values: ShareFormValues): CreateSharePayload {
  const payload: CreateSharePayload = {}
  if (values.slug !== '') payload.slug = values.slug
  if (values.expiresAt !== '') payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  if (values.maxDownloads !== '') payload.maxDownloads = toMaxDownloads(values.maxDownloads)
  return payload
}

export function toUpdateSharePayload(share: Share, values: ShareFormValues): UpdateSharePayload {
  const initial = shareFormDefaults(share)
  const payload: UpdateSharePayload = {}
  if (values.slug !== initial.slug) payload.slug = values.slug
  if (values.expiresAt !== initial.expiresAt) payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  if (values.maxDownloads !== initial.maxDownloads) payload.maxDownloads = toMaxDownloads(values.maxDownloads)
  if (values.disabled !== initial.disabled) payload.disabled = values.disabled
  return payload
}

export function createUploadFileSchema(t: TFunction, maxSizeLabel: string) {
  return z.object({
    name: z.string().max(FILE_NAME_MAX_LENGTH, t('shares.validation.fileNameTooLong', { max: FILE_NAME_MAX_LENGTH })),
    size: z
      .number()
      .min(FILE_MIN_SIZE_BYTES, t('shares.validation.fileEmpty'))
      .max(FILE_MAX_SIZE_BYTES, t('shares.validation.fileTooLarge', { max: maxSizeLabel })),
  })
}
