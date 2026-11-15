import { z } from 'zod';
import {
  LINK_LIST_SORTS,
  LINK_SLUG_MAX_LENGTH,
  LINK_SLUG_REGEX,
  LIST_LIKE_ESCAPE,
  LIST_PAGE_MAX,
  LIST_PAGE_SIZE_DEFAULT,
  LIST_PAGE_SIZE_MAX,
  LIST_SEARCH_MAX_LENGTH,
  UNSIGNED_INTEGER_REGEX,
} from './variables.global.js';

export interface ListPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const publicIdFilter = z
  .string()
  .max(LINK_SLUG_MAX_LENGTH)
  .regex(LINK_SLUG_REGEX, 'invalid id');

const positiveInteger = (max: number) =>
  z
    .string()
    .regex(UNSIGNED_INTEGER_REGEX, 'must be an integer')
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));

export const listQueryShape = {
  q: z.string().trim().min(1).max(LIST_SEARCH_MAX_LENGTH).optional(),
  tag: publicIdFilter.optional(),
  folder: publicIdFilter.optional(),
  sort: z.enum(LINK_LIST_SORTS).default('created_desc'),
  page: positiveInteger(LIST_PAGE_MAX).default(1),
  pageSize: positiveInteger(LIST_PAGE_SIZE_MAX).default(LIST_PAGE_SIZE_DEFAULT),
};

export function toLikePattern(term: string): string {
  const escaped = term.replace(/[!%_]/g, (char) => LIST_LIKE_ESCAPE + char);
  return `%${escaped}%`;
}
