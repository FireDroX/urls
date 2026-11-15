import { z } from 'zod';
import {
  expiresAtSchema,
  linkOrganizationShape,
  slugSchema,
} from '../../../links/dto/in/link-fields.schema.js';
import {
  maxFilesSchema,
  maxTotalBytesSchema,
  titleSchema,
} from './drop-fields.schema.js';

export const updateDropSchema = z
  .strictObject({
    slug: slugSchema.optional(),
    title: titleSchema.nullable().optional(),
    expiresAt: expiresAtSchema.nullable().optional(),
    maxFiles: maxFilesSchema.optional(),
    maxTotalBytes: maxTotalBytesSchema.optional(),
    disabled: z.boolean().optional(),
    ...linkOrganizationShape,
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'at least one field is required',
  );

export type UpdateDropDto = z.infer<typeof updateDropSchema>;
