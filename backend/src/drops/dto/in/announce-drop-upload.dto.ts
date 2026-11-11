import { z } from 'zod';
import { startUploadSchema } from '../../../files/dto/in/start-upload.dto.js';
import {
  DROP_UPLOADER_NAME_MAX_LENGTH,
  TURNSTILE_TOKEN_MAX_LENGTH,
} from '../../../common/variables.global.js';

const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/u;

const uploaderNameSchema = z
  .string()
  .trim()
  .max(DROP_UPLOADER_NAME_MAX_LENGTH)
  .refine(
    (value) => !INVISIBLE_CHARACTERS.test(value),
    'must not contain control or invisible characters',
  )
  .transform((value) => (value === '' ? null : value));

export const announceDropUploadSchema = startUploadSchema.extend({
  turnstileToken: z.string().max(TURNSTILE_TOKEN_MAX_LENGTH).optional(),
  uploaderName: uploaderNameSchema.nullable().optional(),
});

export type AnnounceDropUploadDto = z.infer<typeof announceDropUploadSchema>;
