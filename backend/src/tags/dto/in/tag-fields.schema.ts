import { z } from 'zod';
import {
  TAG_COLOR_REGEX,
  TAG_NAME_MAX_LENGTH,
} from '../../../common/variables.global.js';

const CONTROL_CHARACTERS = /\p{Cc}/u;

export const tagNameSchema = z
  .string()
  .transform((value) => value.normalize('NFC').trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(TAG_NAME_MAX_LENGTH)
      .refine(
        (value) => !CONTROL_CHARACTERS.test(value),
        'must not contain control characters',
      ),
  );

export const tagColorSchema = z
  .string()
  .transform((value) => value.toLowerCase())
  .pipe(z.string().regex(TAG_COLOR_REGEX, 'must be a #rrggbb colour'));
