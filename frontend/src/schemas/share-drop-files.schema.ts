import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { ShareDropFilesPayload } from '#api/drops'
import { DROP_MAX_FILES_LIMIT } from '#schemas/drop.schema'
import { expiresAtField, slugField } from '#schemas/link.schema'
import { maxDownloadsField } from '#schemas/share.schema'
import { fromDateTimeLocal } from '#utils/datetime-local'

export function createShareDropFilesSchema(t: TFunction) {
  return z.object({
    slug: slugField(t, true),
    expiresAt: expiresAtField(t, ''),
    maxDownloads: maxDownloadsField(t),
    fileIds: z
      .array(z.string())
      .min(1, t('drops.share.validation.noFile'))
      .max(DROP_MAX_FILES_LIMIT, t('drops.share.validation.tooManyFiles', { max: DROP_MAX_FILES_LIMIT })),
    closeDrop: z.boolean(),
  })
}

export type ShareDropFilesFormValues = z.infer<ReturnType<typeof createShareDropFilesSchema>>

export function shareDropFilesDefaults(fileIds: string[]): ShareDropFilesFormValues {
  return { slug: '', expiresAt: '', maxDownloads: '', fileIds, closeDrop: true }
}

export function toShareDropFilesPayload(values: ShareDropFilesFormValues): ShareDropFilesPayload {
  const payload: ShareDropFilesPayload = { fileIds: values.fileIds, closeDrop: values.closeDrop }
  if (values.slug !== '') payload.slug = values.slug
  if (values.expiresAt !== '') payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  if (values.maxDownloads !== '') payload.maxDownloads = Number(values.maxDownloads)
  return payload
}
