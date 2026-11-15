import { z } from 'zod';
import { listQueryShape } from '../../../common/list-query.js';
import { LINK_LIST_STATES } from '../../../common/variables.global.js';

export const listSharesQuerySchema = z.strictObject({
  ...listQueryShape,
  state: z.enum(LINK_LIST_STATES).optional(),
});

export type ListSharesQuery = z.infer<typeof listSharesQuerySchema>;
