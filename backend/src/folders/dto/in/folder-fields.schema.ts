import { z } from 'zod';
import { FOLDER_NAME_MAX_LENGTH } from '../../../common/variables.global.js';

const CONTROL_CHARACTERS = /\p{Cc}/u;

export const folderNameSchema = z
  .string()
  .transform((value) => value.normalize('NFC').trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(FOLDER_NAME_MAX_LENGTH)
      .refine(
        (value) => !CONTROL_CHARACTERS.test(value),
        'must not contain control characters',
      ),
  );
