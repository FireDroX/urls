import type { TFunction } from 'i18next'
import { summarizeError } from '#lib/api-errors'

const NOT_FOUND = 404
const TAG_NOT_FOUND_MESSAGE = 'Tag not found'
const FOLDER_NOT_FOUND_MESSAGE = 'Folder not found'

export type MissingOrganization = 'tag' | 'folder'

export function linkOrganizationNotFound(error: unknown): MissingOrganization | null {
  const summary = summarizeError(error)
  if (summary?.status !== NOT_FOUND) return null
  if (summary.serverMessage === TAG_NOT_FOUND_MESSAGE) return 'tag'
  if (summary.serverMessage === FOLDER_NOT_FOUND_MESSAGE) return 'folder'
  return null
}

export function linkOrganizationErrorMessage(error: unknown, t: TFunction): string | null {
  const missing = linkOrganizationNotFound(error)
  return missing === null ? null : t(`linkOrganization.errors.${missing}NotFound`)
}
