import { z } from 'zod';
import {
  LINK_STATS_DEFAULT_DAYS,
  LINK_STATS_MAX_DAYS,
  LINK_STATS_MIN_DAYS,
  UNSIGNED_INTEGER_REGEX,
} from '../../../common/variables.global.js';

export const linkStatsQuerySchema = z.strictObject({
  days: z
    .string()
    .regex(UNSIGNED_INTEGER_REGEX, 'must be an integer')
    .transform(Number)
    .pipe(z.number().int().min(LINK_STATS_MIN_DAYS).max(LINK_STATS_MAX_DAYS))
    .default(LINK_STATS_DEFAULT_DAYS),
});

export type LinkStatsQueryDto = z.infer<typeof linkStatsQuerySchema>;
