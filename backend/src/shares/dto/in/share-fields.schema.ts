import { z } from 'zod';
import { SHARE_MAX_DOWNLOADS_LIMIT } from '../../../common/variables.global.js';

export const maxDownloadsSchema = z
  .number()
  .int()
  .min(1)
  .max(SHARE_MAX_DOWNLOADS_LIMIT);
