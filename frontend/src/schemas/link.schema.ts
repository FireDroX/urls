import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { CreateLinkPayload, Link, UpdateLinkPayload } from '#api/links'
import {
  linkOrganizationDefaults,
  linkOrganizationFields,
  toCreateOrganizationPayload,
  toUpdateOrganizationPayload,
} from '#schemas/link-organization.schema'
import { fromDateTimeLocal, isFutureDateTimeLocal, toDateTimeLocal } from '#utils/datetime-local'

export const LINK_DESTINATION_MAX_LENGTH = 2048
const LINK_SLUG_MIN_LENGTH = 3
export const LINK_SLUG_MAX_LENGTH = 64
const LINK_DESTINATION_PROTOCOLS: readonly string[] = ['http:', 'https:']
const LINK_SLUG_REGEX = /^[A-Za-z0-9_-]+$/
const RESERVED_LINK_SLUGS: readonly string[] = [
  'account',
  'admin',
  'all',
  'api',
  'assets',
  'd',
  'dashboard',
  'health',
  'links',
  'login',
  'logout',
  'new',
  'r',
  'settings',
  'static',
  'u',
]

function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && LINK_DESTINATION_PROTOCOLS.includes(new URL(value).protocol)
}

function isReservedSlug(value: string): boolean {
  return RESERVED_LINK_SLUGS.includes(value.toLowerCase())
}

function destinationField(t: TFunction) {
  return z
    .string()
    .trim()
    .min(1, t('links.validation.destinationRequired'))
    .max(LINK_DESTINATION_MAX_LENGTH, t('links.validation.destinationTooLong', { max: LINK_DESTINATION_MAX_LENGTH }))
    .refine(isHttpUrl, t('links.validation.destinationInvalid'))
}

export function slugField(t: TFunction, optional: boolean) {
  return z
    .string()
    .trim()
    .refine(
      (value) => (optional && value === '') || value.length >= LINK_SLUG_MIN_LENGTH,
      t('links.validation.slugTooShort', { min: LINK_SLUG_MIN_LENGTH }),
    )
    .refine(
      (value) => value.length <= LINK_SLUG_MAX_LENGTH,
      t('links.validation.slugTooLong', { max: LINK_SLUG_MAX_LENGTH }),
    )
    .refine((value) => value === '' || LINK_SLUG_REGEX.test(value), t('links.validation.slugCharacters'))
    .refine((value) => !isReservedSlug(value), t('links.validation.slugReserved'))
}

export function expiresAtField(t: TFunction, unchangedValue: string) {
  return z
    .string()
    .refine(
      (value) => value === '' || value === unchangedValue || isFutureDateTimeLocal(value),
      t('links.validation.expiresInPast'),
    )
}

export function createLinkFormSchema(t: TFunction, link?: Link) {
  return z.object({
    destination: destinationField(t),
    slug: slugField(t, link === undefined),
    expiresAt: expiresAtField(t, toDateTimeLocal(link?.expiresAt ?? null)),
    disabled: z.boolean(),
    ...linkOrganizationFields(t),
  })
}

export type LinkFormValues = z.infer<ReturnType<typeof createLinkFormSchema>>

export function linkFormDefaults(link?: Link): LinkFormValues {
  return {
    destination: link?.destination ?? '',
    slug: link?.id ?? '',
    expiresAt: toDateTimeLocal(link?.expiresAt ?? null),
    disabled: link?.disabled ?? false,
    ...linkOrganizationDefaults(link),
  }
}

export function toCreateLinkPayload(values: LinkFormValues): CreateLinkPayload {
  const payload: CreateLinkPayload = { destination: values.destination, ...toCreateOrganizationPayload(values) }
  if (values.slug !== '') payload.slug = values.slug
  if (values.expiresAt !== '') payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  return payload
}

export function toUpdateLinkPayload(link: Link, values: LinkFormValues): UpdateLinkPayload {
  const initial = linkFormDefaults(link)
  const payload: UpdateLinkPayload = toUpdateOrganizationPayload(link, values)
  if (values.destination !== initial.destination) payload.destination = values.destination
  if (values.slug !== initial.slug) payload.slug = values.slug
  if (values.expiresAt !== initial.expiresAt) payload.expiresAt = fromDateTimeLocal(values.expiresAt)
  if (values.disabled !== initial.disabled) payload.disabled = values.disabled
  return payload
}
