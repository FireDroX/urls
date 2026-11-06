import { describe, expect, it } from 'vitest';
import type { Link } from '../links/entities/link.entity.js';
import { isFileInUse } from './file-usage.js';

const link = (overrides: Partial<Link>) =>
  ({ type: 'share', deletedAt: null, ...overrides }) as Link;

describe('isFileInUse', () => {
  it.each([
    ['an active share', {}, true],
    ['a disabled share', { disabled: true }, true],
    ['an expired share', { expiresAt: new Date('2020-01-01') }, true],
    ['a deleted share', { deletedAt: new Date() }, false],
    ['a drop link', { type: 'drop' as const }, false],
  ])('%s: in use is %s', (_label, overrides, expected) => {
    expect(isFileInUse(link(overrides))).toBe(expected);
  });
});
