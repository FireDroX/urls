import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { listQueryShape, toLikePattern } from './list-query.js';
import {
  LIST_PAGE_MAX,
  LIST_PAGE_SIZE_DEFAULT,
  LIST_PAGE_SIZE_MAX,
  LIST_SEARCH_MAX_LENGTH,
} from './variables.global.js';

const schema = z.strictObject(listQueryShape);

describe('listQueryShape', () => {
  it('applies the defaults', () => {
    expect(schema.parse({})).toEqual({
      sort: 'created_desc',
      page: 1,
      pageSize: LIST_PAGE_SIZE_DEFAULT,
    });
  });

  it('parses every parameter', () => {
    expect(
      schema.parse({
        q: '  hello ',
        tag: 'abc12345',
        folder: 'none',
        sort: 'slug_desc',
        page: '3',
        pageSize: '10',
      }),
    ).toEqual({
      q: 'hello',
      tag: 'abc12345',
      folder: 'none',
      sort: 'slug_desc',
      page: 3,
      pageSize: 10,
    });
  });

  it.each([
    ['page 0', { page: '0' }],
    ['page above the maximum', { page: String(LIST_PAGE_MAX + 1) }],
    ['negative page', { page: '-1' }],
    ['non-integer page', { page: '1.5' }],
    ['page size 0', { pageSize: '0' }],
    [
      'page size above the maximum',
      { pageSize: String(LIST_PAGE_SIZE_MAX + 1) },
    ],
    ['non-numeric page size', { pageSize: 'abc' }],
    ['empty search', { q: '' }],
    ['blank search', { q: '   ' }],
    ['too long search', { q: 'a'.repeat(LIST_SEARCH_MAX_LENGTH + 1) }],
    ['malformed tag', { tag: 'a b' }],
    ['malformed folder', { folder: "x'; DROP" }],
    ['empty tag', { tag: '' }],
    ['unknown sort', { sort: 'random' }],
    ['unknown parameter', { foo: 'bar' }],
    ['repeated parameter', { q: ['a', 'b'] }],
  ])('rejects %s', (_label, query) => {
    expect(schema.safeParse(query).success).toBe(false);
  });

  it('accepts the bounds', () => {
    expect(
      schema.parse({
        page: String(LIST_PAGE_MAX),
        pageSize: String(LIST_PAGE_SIZE_MAX),
        q: 'a'.repeat(LIST_SEARCH_MAX_LENGTH),
      }),
    ).toMatchObject({ page: LIST_PAGE_MAX, pageSize: LIST_PAGE_SIZE_MAX });
  });
});

describe('toLikePattern', () => {
  it('wraps the term', () => {
    expect(toLikePattern('abc')).toBe('%abc%');
  });

  it.each([
    ['%', '%!%%'],
    ['_', '%!_%'],
    ['!', '%!!%'],
    ['50%_off!', '%50!%!_off!!%'],
  ])('escapes %s', (term, pattern) => {
    expect(toLikePattern(term)).toBe(pattern);
  });
});
