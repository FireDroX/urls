import { describe, expect, it } from 'vitest';
import { bigintToNumber } from './bigint-to-number.js';

describe('bigintToNumber', () => {
  it('converts MySQL bigint strings to numbers', () => {
    expect(bigintToNumber.from('9007199254740')).toBe(9_007_199_254_740);
    expect(bigintToNumber.from(12)).toBe(12);
  });

  it('keeps null as null when reading', () => {
    expect(bigintToNumber.from(null)).toBeNull();
  });

  it('keeps null and undefined untouched when writing', () => {
    expect(bigintToNumber.to(null)).toBeNull();
    expect(bigintToNumber.to(undefined)).toBeUndefined();
    expect(bigintToNumber.to(5)).toBe(5);
  });
});
