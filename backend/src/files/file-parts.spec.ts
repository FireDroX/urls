import { describe, expect, it } from 'vitest';
import { ValidationException } from '../common/exceptions/validation.exception.js';
import { FILE_PART_SIZE_BYTES } from '../common/variables.global.js';
import {
  completeParts,
  expectedPartSize,
  parseContentLength,
  parsePartNumber,
  partCountOf,
} from './file-parts.js';

const PART = FILE_PART_SIZE_BYTES;
const SIZE = 2 * PART + 10;

function part(partNumber: number, size: number) {
  return { partNumber, size, etag: `"etag-${partNumber}"` };
}

describe('file parts', () => {
  it('splits a file into parts of FILE_PART_SIZE_BYTES, the last one shorter', () => {
    expect(partCountOf(1)).toBe(1);
    expect(partCountOf(PART)).toBe(1);
    expect(partCountOf(SIZE)).toBe(3);
    expect(expectedPartSize(SIZE, 1)).toBe(PART);
    expect(expectedPartSize(SIZE, 3)).toBe(10);
    expect(expectedPartSize(PART, 1)).toBe(PART);
  });

  it('accepts a part number between 1 and the part count only', () => {
    expect(parsePartNumber('3', SIZE)).toBe(3);
    for (const raw of ['0', '4', '-1', '1.5', 'abc', '', '1e1']) {
      expect(() => parsePartNumber(raw, SIZE)).toThrow(ValidationException);
    }
  });

  it('requires a Content-Length equal to the expected part size', () => {
    expect(parseContentLength('10', undefined, 10)).toBe(10);
    for (const header of [undefined, '9', '11', '+10', 'ten']) {
      expect(() => parseContentLength(header, undefined, 10)).toThrow(
        ValidationException,
      );
    }
  });

  it('refuses a chunked body, which has no length to check up front', () => {
    expect(() => parseContentLength('10', 'chunked', 10)).toThrow(
      ValidationException,
    );
  });

  it('returns the parts in order when every part is there with its size', () => {
    expect(
      completeParts([part(3, 10), part(1, PART), part(2, PART)], SIZE),
    ).toEqual([part(1, PART), part(2, PART), part(3, 10)]);
  });

  it('reports missing or mis-sized parts', () => {
    expect(completeParts([part(1, PART), part(3, 10)], SIZE)).toBeNull();
    expect(
      completeParts([part(1, PART), part(2, PART - 1), part(3, 11)], SIZE),
    ).toBeNull();
    expect(
      completeParts([part(1, PART), part(2, PART), part(4, 10)], SIZE),
    ).toBeNull();
    expect(completeParts([], SIZE)).toBeNull();
  });
});
