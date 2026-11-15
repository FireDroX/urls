import { z } from 'zod';
import {
  destinationSchema,
  expiresAtSchema,
  linkOrganizationShape,
  slugSchema,
} from './link-fields.schema.js';

export const updateLinkSchema = z
  .strictObject({
    destination: destinationSchema.optional(),
    slug: slugSchema.optional(),
    expiresAt: expiresAtSchema.nullable().optional(),
    disabled: z.boolean().optional(),
    ...linkOrganizationShape,
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'at least one field is required',
  );

export type UpdateLinkDto = z.infer<typeof updateLinkSchema>;
