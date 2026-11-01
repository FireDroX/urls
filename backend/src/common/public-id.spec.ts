import { describe, expect, it } from 'vitest';
import { generatePublicId } from './public-id.js';

describe('generatePublicId', () => {
  it('returns 8 base62 characters', () => {
    expect(generatePublicId()).toMatch(/^[0-9A-Za-z]{8}$/);
  });

  it('does not repeat itself over many draws', () => {
    const ids = new Set(Array.from({ length: 10_000 }, generatePublicId));

    expect(ids.size).toBe(10_000);
  });
});
