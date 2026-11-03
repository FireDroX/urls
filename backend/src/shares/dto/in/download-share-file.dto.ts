import { z } from 'zod';
import { TURNSTILE_TOKEN_MAX_LENGTH } from '../../../common/variables.global.js';

export const downloadShareFileSchema = z.strictObject({
  turnstileToken: z.string().max(TURNSTILE_TOKEN_MAX_LENGTH).optional(),
});

export type DownloadShareFileDto = z.infer<typeof downloadShareFileSchema>;
