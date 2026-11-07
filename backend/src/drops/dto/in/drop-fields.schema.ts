import { z } from 'zod';
import {
  DROP_TITLE_MAX_LENGTH,
  FILES_STORAGE_QUOTA_BYTES,
  SHARE_FILES_MAX,
} from '../../../common/variables.global.js';

const CONTROL_CHARACTERS = /\p{Cc}/u;

export const titleSchema = z
  .string()
  .trim()
  .min(1)
  .max(DROP_TITLE_MAX_LENGTH)
  .refine(
    (value) => !CONTROL_CHARACTERS.test(value),
    'must not contain control characters',
  );

export const maxFilesSchema = z.number().int().min(1).max(SHARE_FILES_MAX);

export const maxTotalBytesSchema = z
  .number()
  .int()
  .min(1)
  .max(FILES_STORAGE_QUOTA_BYTES);
