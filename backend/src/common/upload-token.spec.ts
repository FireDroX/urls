import { describe, expect, it } from 'vitest';
import {
  generateUploadToken,
  hashUploadToken,
  uploadTokenMatches,
} from './upload-token.js';
import { DROP_UPLOAD_TOKEN_LENGTH } from './variables.global.js';

describe('upload token', () => {
  it('generates a 43 character token and keeps only its sha256', () => {
    const { token, hash } = generateUploadToken();
    expect(token).toHaveLength(DROP_UPLOAD_TOKEN_LENGTH);
    expect(hash).toBe(hashUploadToken(token));
    expect(hash).not.toContain(token);
    expect(generateUploadToken().token).not.toBe(token);
  });

  it('accepts the right token', () => {
    const { token, hash } = generateUploadToken();
    expect(uploadTokenMatches(token, hash)).toBe(true);
  });

  it('refuses a missing, wrong, malformed or other file token', () => {
    const { token, hash } = generateUploadToken();
    const other = generateUploadToken();
    expect(uploadTokenMatches(undefined, hash)).toBe(false);
    expect(uploadTokenMatches(other.token, hash)).toBe(false);
    expect(uploadTokenMatches(token.slice(1), hash)).toBe(false);
    expect(uploadTokenMatches(token, null)).toBe(false);
    expect(uploadTokenMatches(token, 'not-a-hash')).toBe(false);
  });
});
