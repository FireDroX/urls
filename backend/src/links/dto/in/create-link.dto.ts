import { z } from 'zod';
import {
  destinationSchema,
  expiresAtSchema,
  linkOrganizationShape,
  slugSchema,
} from './link-fields.schema.js';

export const createLinkSchema = z.strictObject({
  destination: destinationSchema,
  slug: slugSchema.optional(),
  expiresAt: expiresAtSchema.nullable().optional(),
  ...linkOrganizationShape,
});

export type CreateLinkDto = z.infer<typeof createLinkSchema>;
