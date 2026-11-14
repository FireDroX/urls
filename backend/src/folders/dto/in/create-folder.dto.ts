import { z } from 'zod';
import { folderNameSchema } from './folder-fields.schema.js';

export const createFolderSchema = z.strictObject({
  name: folderNameSchema,
});

export type CreateFolderDto = z.infer<typeof createFolderSchema>;
