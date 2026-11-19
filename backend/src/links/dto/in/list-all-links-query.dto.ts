import { z } from 'zod';
import { listQueryShape } from '../../../common/list-query.js';
import {
  ALL_LINKS_LIST_STATES,
  LINK_TYPES,
} from '../../../common/variables.global.js';

export const listAllLinksQuerySchema = z.strictObject({
  ...listQueryShape,
  type: z.enum(LINK_TYPES).optional(),
  state: z.enum(ALL_LINKS_LIST_STATES).optional(),
});

export type ListAllLinksQuery = z.infer<typeof listAllLinksQuerySchema>;
