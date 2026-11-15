import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { Folder, FolderPayload } from '#api/folders'

export const FOLDER_NAME_MAX_LENGTH = 100
const CONTROL_CHARACTERS = /\p{Cc}/u

export function createFolderFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('organization.folders.validation.nameRequired'))
      .max(FOLDER_NAME_MAX_LENGTH, t('organization.folders.validation.nameTooLong', { max: FOLDER_NAME_MAX_LENGTH }))
      .refine((value) => !CONTROL_CHARACTERS.test(value), t('organization.folders.validation.nameCharacters')),
  })
}

export type FolderFormValues = z.infer<ReturnType<typeof createFolderFormSchema>>

export function folderFormDefaults(folder?: Folder): FolderFormValues {
  return { name: folder?.name ?? '' }
}

export function toFolderPayload(values: FolderFormValues): FolderPayload {
  return { name: values.name }
}
