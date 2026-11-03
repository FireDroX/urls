import { ValidationException } from '../common/exceptions/validation.exception.js';
import {
  FILE_PART_SIZE_BYTES,
  UNSIGNED_INTEGER_REGEX,
} from '../common/variables.global.js';
import type { UploadedPart } from '../storage/services/storage.service.js';

export function partCountOf(fileSize: number): number {
  return Math.ceil(fileSize / FILE_PART_SIZE_BYTES);
}

export function expectedPartSize(fileSize: number, partNumber: number): number {
  return Math.min(
    FILE_PART_SIZE_BYTES,
    fileSize - (partNumber - 1) * FILE_PART_SIZE_BYTES,
  );
}

export function parsePartNumber(raw: string, fileSize: number): number {
  const partNumber = UNSIGNED_INTEGER_REGEX.test(raw) ? Number(raw) : NaN;
  if (
    !Number.isSafeInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > partCountOf(fileSize)
  ) {
    throw new ValidationException(
      `part number must be an integer from 1 to ${partCountOf(fileSize)}`,
    );
  }
  return partNumber;
}

export function parseContentLength(
  header: string | undefined,
  transferEncoding: string | undefined,
  expected: number,
): number {
  if (
    transferEncoding !== undefined ||
    header === undefined ||
    !UNSIGNED_INTEGER_REGEX.test(header) ||
    Number(header) !== expected
  ) {
    throw new ValidationException(
      `Content-Length is required and must be ${expected} for this part`,
    );
  }
  return expected;
}

export function completeParts(
  parts: UploadedPart[],
  fileSize: number,
): UploadedPart[] | null {
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  const complete =
    sorted.length === partCountOf(fileSize) &&
    sorted.every(
      (part, index) =>
        part.partNumber === index + 1 &&
        part.size === expectedPartSize(fileSize, index + 1),
    );
  return complete ? sorted : null;
}
