import { z } from 'zod';
import {
  expiresAtSchema,
  linkOrganizationShape,
  slugSchema,
} from '../../../links/dto/in/link-fields.schema.js';
import { maxDownloadsSchema } from './share-fields.schema.js';

export const updateShareSchema = z
  .strictObject({
    slug: slugSchema.optional(),
    expiresAt: expiresAtSchema.nullable().optional(),
    maxDownloads: maxDownloadsSchema.nullable().optional(),
    disabled: z.boolean().optional(),
    ...linkOrganizationShape,
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'at least one field is required',
  );

export type UpdateShareDto = z.infer<typeof updateShareSchema>;
