import { z } from 'zod';
import { listQueryShape } from '../../../common/list-query.js';
import { DROP_STATES } from '../../../common/variables.global.js';

export const listDropsQuerySchema = z.strictObject({
  ...listQueryShape,
  state: z.enum(DROP_STATES).optional(),
});

export type ListDropsQuery = z.infer<typeof listDropsQuerySchema>;
