import { z } from 'zod';
import { DEFAULT_TAG_COLOR } from '../../../common/variables.global.js';
import { tagColorSchema, tagNameSchema } from './tag-fields.schema.js';

export const createTagSchema = z.strictObject({
  name: tagNameSchema,
  color: tagColorSchema.default(DEFAULT_TAG_COLOR),
});

export type CreateTagDto = z.infer<typeof createTagSchema>;
