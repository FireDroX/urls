import { z } from 'zod';
import {
  expiresAtSchema,
  slugSchema,
} from '../../../links/dto/in/link-fields.schema.js';
import { maxDownloadsSchema } from './share-fields.schema.js';

export const createShareSchema = z.strictObject({
  slug: slugSchema.optional(),
  expiresAt: expiresAtSchema.nullable().optional(),
  maxDownloads: maxDownloadsSchema.nullable().optional(),
});

export type CreateShareDto = z.infer<typeof createShareSchema>;
