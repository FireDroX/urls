import { z } from 'zod';
import {
  expiresAtSchema,
  slugSchema,
} from '../../../links/dto/in/link-fields.schema.js';
import {
  maxFilesSchema,
  maxTotalBytesSchema,
  titleSchema,
} from './drop-fields.schema.js';

export const createDropSchema = z.strictObject({
  slug: slugSchema.optional(),
  title: titleSchema.nullable().optional(),
  expiresAt: expiresAtSchema.nullable().optional(),
  maxFiles: maxFilesSchema,
  maxTotalBytes: maxTotalBytesSchema,
});

export type CreateDropDto = z.infer<typeof createDropSchema>;
