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
    ['an open drop', { type: 'drop' as const }, true],
    ['a disabled drop', { type: 'drop' as const, disabled: true }, true],
    [
      'an expired drop',
      { type: 'drop' as const, expiresAt: new Date('2020-01-01') },
      true,
    ],
    [
      'a full drop',
      { type: 'drop' as const, maxFiles: 1, maxTotalBytes: 1 },
      true,
    ],
    ['a deleted drop', { type: 'drop' as const, deletedAt: new Date() }, false],
    ['a redirect', { type: 'redirect' as const }, false],
  ])('%s: in use is %s', (_label, overrides, expected) => {
    expect(isFileInUse(link(overrides))).toBe(expected);
  });
});
