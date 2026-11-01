import { z } from 'zod';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_REGEX,
  PASSWORD_MAX_LENGTH,
} from '../../../common/variables.global.js';

const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

export const loginSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX_LENGTH)
    .regex(EMAIL_REGEX, 'must be a valid email'),
  password: z.string().min(1, 'is required').max(PASSWORD_MAX_LENGTH),
  turnstileToken: z.string().max(TURNSTILE_TOKEN_MAX_LENGTH).optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
