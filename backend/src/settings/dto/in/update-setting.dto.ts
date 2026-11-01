import { z } from 'zod';
import { SETTING_VALUE_MAX_LENGTH } from '../../../common/variables.global.js';

export const updateSettingSchema = z.strictObject({
  value: z.string().trim().min(1, 'is required').max(SETTING_VALUE_MAX_LENGTH),
});

export type UpdateSettingDto = z.infer<typeof updateSettingSchema>;
