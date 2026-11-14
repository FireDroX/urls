import { z } from 'zod';
import { tagColorSchema, tagNameSchema } from './tag-fields.schema.js';

export const updateTagSchema = z
  .strictObject({
    name: tagNameSchema.optional(),
    color: tagColorSchema.optional(),
  })
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    'at least one field is required',
  );

export type UpdateTagDto = z.infer<typeof updateTagSchema>;
