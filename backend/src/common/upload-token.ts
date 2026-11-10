import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  DROP_UPLOAD_TOKEN_BYTES,
  DROP_UPLOAD_TOKEN_HASH_ALGORITHM,
  DROP_UPLOAD_TOKEN_LENGTH,
  FILE_SHA256_REGEX,
} from './variables.global.js';

export function hashUploadToken(token: string): string {
  return createHash(DROP_UPLOAD_TOKEN_HASH_ALGORITHM)
    .update(token)
    .digest('hex');
}

export function generateUploadToken(): { token: string; hash: string } {
  const token = randomBytes(DROP_UPLOAD_TOKEN_BYTES).toString('base64url');
  return { token, hash: hashUploadToken(token) };
}

export function uploadTokenMatches(
  presented: string | undefined,
  storedHash: string | null,
): boolean {
  if (
    typeof presented !== 'string' ||
    presented.length !== DROP_UPLOAD_TOKEN_LENGTH ||
    storedHash === null ||
    !FILE_SHA256_REGEX.test(storedHash)
  ) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(hashUploadToken(presented), 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}
