import { describe, expect, it } from 'vitest';
import { TAG_NAME_MAX_LENGTH } from '../common/variables.global.js';
import { tagNameKey } from './tag-name-key.js';

const NAME_KEY_COLUMN_LENGTH = 100;

describe('tagNameKey', () => {
  it('lowercases the name', () => {
    expect(tagNameKey('Work')).toBe('work');
  });

  it('keeps accents', () => {
    expect(tagNameKey('Café')).not.toBe(tagNameKey('Cafe'));
  });

  it('gives the same key to composed and decomposed forms', () => {
    expect(tagNameKey('Café')).toBe(tagNameKey('Café'));
  });

  it('composes again after lowercasing', () => {
    expect(tagNameKey('J̌')).toBe(tagNameKey('ǰ'));
  });

  it('fits the name_key column for the worst-case expansion', () => {
    const key = tagNameKey('İ'.repeat(TAG_NAME_MAX_LENGTH));

    expect([...key].length).toBeLessThanOrEqual(NAME_KEY_COLUMN_LENGTH);
  });
});
