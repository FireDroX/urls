import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../../../common/variables.global.js';

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, 'is required').max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(1, 'is required').max(PASSWORD_MAX_LENGTH),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
