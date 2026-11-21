import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { LinkOrganization, LinkOrganizationPayload } from '#api/link-organization'

export const LINK_TAGS_MAX = 20

export interface LinkOrganizationValues {
  tagIds: string[]
  folderId: string | null
}

export function linkOrganizationFields(t: TFunction) {
  return {
    tagIds: z.array(z.string()).max(LINK_TAGS_MAX, t('linkOrganization.validation.tooManyTags', { max: LINK_TAGS_MAX })),
    folderId: z.string().nullable(),
  }
}

export function linkOrganizationDefaults(link?: LinkOrganization): LinkOrganizationValues {
  return {
    tagIds: link?.tags.map((tag) => tag.id) ?? [],
    folderId: link?.folder?.id ?? null,
  }
}

export function toCreateOrganizationPayload(values: LinkOrganizationValues): LinkOrganizationPayload {
  const payload: LinkOrganizationPayload = {}
  if (values.tagIds.length > 0) payload.tagIds = values.tagIds
  if (values.folderId !== null) payload.folderId = values.folderId
  return payload
}

export function toggleTagId(tagIds: string[], id: string, checked: boolean): string[] {
  if (!checked) return tagIds.filter((existing) => existing !== id)
  if (tagIds.includes(id) || tagIds.length >= LINK_TAGS_MAX) return tagIds
  return [...tagIds, id]
}

function sameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && new Set([...left, ...right]).size === left.length
}

export function toUpdateOrganizationPayload(link: LinkOrganization, values: LinkOrganizationValues): LinkOrganizationPayload {
  const initial = linkOrganizationDefaults(link)
  const payload: LinkOrganizationPayload = {}
  if (!sameIds(values.tagIds, initial.tagIds)) payload.tagIds = values.tagIds
  if (values.folderId !== initial.folderId) payload.folderId = values.folderId
  return payload
}
