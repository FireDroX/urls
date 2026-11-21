import { z } from 'zod';
import {
  LINK_DESTINATION_MAX_LENGTH,
  LINK_DESTINATION_PROTOCOLS,
  LINK_SLUG_MAX_LENGTH,
  LINK_SLUG_MIN_LENGTH,
  LINK_SLUG_REGEX,
  LINK_TAGS_MAX,
  RESERVED_LINK_SLUGS,
} from '../../../common/variables.global.js';

function hasAllowedProtocol(value: string): boolean {
  return (
    URL.canParse(value) &&
    LINK_DESTINATION_PROTOCOLS.includes(new URL(value).protocol)
  );
}

function isReservedSlug(value: string): boolean {
  return RESERVED_LINK_SLUGS.includes(value.toLowerCase());
}

export const destinationSchema = z
  .string()
  .trim()
  .min(1, 'is required')
  .max(LINK_DESTINATION_MAX_LENGTH)
  .refine(hasAllowedProtocol, 'must be an http or https URL')
  .transform((value) => new URL(value).href)
  .pipe(z.string().max(LINK_DESTINATION_MAX_LENGTH));

export const slugSchema = z
  .string()
  .trim()
  .min(LINK_SLUG_MIN_LENGTH)
  .max(LINK_SLUG_MAX_LENGTH)
  .regex(LINK_SLUG_REGEX, 'may only contain letters, digits, "-" and "_"')
  .refine((value) => !isReservedSlug(value), 'is reserved');

export const expiresAtSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() > Date.now(), 'must be in the future');

const organizationIdSchema = z.string().trim().min(1).max(LINK_SLUG_MAX_LENGTH);

export const tagIdsSchema = z
  .array(organizationIdSchema)
  .max(LINK_TAGS_MAX)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'must not contain duplicates',
  );

export const folderIdSchema = organizationIdSchema.nullable();

export const linkOrganizationShape = {
  tagIds: tagIdsSchema.optional(),
  folderId: folderIdSchema.optional(),
};
