import { z } from 'zod';
import {
  destinationSchema,
  expiresAtSchema,
  slugSchema,
} from './link-fields.schema.js';

export const createLinkSchema = z.strictObject({
  destination: destinationSchema,
  slug: slugSchema.optional(),
  expiresAt: expiresAtSchema.nullable().optional(),
});

export type CreateLinkDto = z.infer<typeof createLinkSchema>;
