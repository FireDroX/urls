import { z } from 'zod';
import {
  FILE_PUBLIC_ID_MAX_LENGTH,
  SHARE_FILES_MAX,
} from '../../../common/variables.global.js';
import { createShareSchema } from '../../../shares/dto/in/create-share.dto.js';

const shareFields = createShareSchema.omit({
  tagIds: true,
  folderId: true,
}).shape;

export const shareDropFilesSchema = z.strictObject({
  ...shareFields,
  fileIds: z
    .array(z.string().trim().min(1).max(FILE_PUBLIC_ID_MAX_LENGTH))
    .min(1)
    .max(SHARE_FILES_MAX)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'fileIds must be unique',
    }),
  closeDrop: z.boolean(),
});

export type ShareDropFilesDto = z.infer<typeof shareDropFilesSchema>;
