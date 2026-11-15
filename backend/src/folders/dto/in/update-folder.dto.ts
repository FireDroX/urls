import { z } from 'zod';
import { folderNameSchema } from './folder-fields.schema.js';

export const updateFolderSchema = z.strictObject({
  name: folderNameSchema,
});

export type UpdateFolderDto = z.infer<typeof updateFolderSchema>;
