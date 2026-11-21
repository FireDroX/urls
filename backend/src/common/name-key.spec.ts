import { describe, expect, it } from 'vitest';
import {
  FOLDER_NAME_MAX_LENGTH,
  TAG_NAME_MAX_LENGTH,
} from './variables.global.js';
import { toNameKey } from './name-key.js';

const TAG_KEY_COLUMN_LENGTH = 100;
const FOLDER_KEY_COLUMN_LENGTH = 200;

describe('toNameKey', () => {
  it('lowercases the name', () => {
    expect(toNameKey('Work')).toBe('work');
  });

  it('keeps accents', () => {
    expect(toNameKey('Café')).not.toBe(toNameKey('Cafe'));
  });

  it('gives the same key to composed and decomposed forms', () => {
    expect(toNameKey('Café')).toBe(toNameKey('Café'));
  });

  it('composes again after lowercasing', () => {
    expect(toNameKey('J̌')).toBe(toNameKey('ǰ'));
  });

  it('fits the tag name_key column for the worst-case expansion', () => {
    const key = toNameKey('İ'.repeat(TAG_NAME_MAX_LENGTH));

    expect([...key].length).toBeLessThanOrEqual(TAG_KEY_COLUMN_LENGTH);
  });

  it('fits the folder name_key column for the worst-case expansion', () => {
    const key = toNameKey('İ'.repeat(FOLDER_NAME_MAX_LENGTH));

    expect([...key].length).toBeLessThanOrEqual(FOLDER_KEY_COLUMN_LENGTH);
  });
});
