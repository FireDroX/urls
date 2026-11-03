import { z } from 'zod';
import {
  FILE_MIN_SIZE_BYTES,
  FILE_NAME_INPUT_MAX_LENGTH,
  FILE_NAME_MAX_LENGTH,
  FILE_SHA256_REGEX,
} from '../../../common/variables.global.js';

const PATH_SEPARATORS = /[/\\]/;
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
const DOTS_ONLY = /^\.+$/;

export function cleanFileName(name: string): string {
  const baseName = name.normalize('NFC').split(PATH_SEPARATORS).pop() ?? '';
  return baseName.replace(INVISIBLE_CHARACTERS, '').trim();
}

export const startUploadSchema = z.strictObject({
  name: z
    .string()
    .max(FILE_NAME_INPUT_MAX_LENGTH)
    .transform(cleanFileName)
    .pipe(
      z
        .string()
        .min(1)
        .max(FILE_NAME_MAX_LENGTH)
        .refine((name) => !DOTS_ONLY.test(name), 'invalid file name'),
    ),
  size: z.number().int().min(FILE_MIN_SIZE_BYTES).max(Number.MAX_SAFE_INTEGER),
  sha256: z.string().trim().toLowerCase().regex(FILE_SHA256_REGEX),
});

export type StartUploadDto = z.infer<typeof startUploadSchema>;
