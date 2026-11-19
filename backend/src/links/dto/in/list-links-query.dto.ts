import { z } from 'zod';
import { listQueryShape } from '../../../common/list-query.js';
import {
  LINK_HEALTH_FILTERS,
  LINK_LIST_STATES,
} from '../../../common/variables.global.js';

export const listLinksQuerySchema = z.strictObject({
  ...listQueryShape,
  state: z.enum(LINK_LIST_STATES).optional(),
  health: z.enum(LINK_HEALTH_FILTERS).optional(),
});

export type ListLinksQuery = z.infer<typeof listLinksQuerySchema>;
