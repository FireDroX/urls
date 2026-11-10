import { describe, expect, it } from 'vitest';
import { DropExpiredException } from '../common/exceptions/drops/drop-expired.exception.js';
import { DropLimitExceededException } from '../common/exceptions/drops/drop-limit-exceeded.exception.js';
import { DropNotFoundException } from '../common/exceptions/drops/drop-not-found.exception.js';
import { FILES_STORAGE_QUOTA_BYTES } from '../common/variables.global.js';
import type { Link } from '../links/entities/link.entity.js';
import { dropUploadLimits } from './drop-upload-limits.js';

const now = new Date('2026-11-10T12:00:00Z');

function drop(overrides: Partial<Link> = {}): Link {
  return {
    type: 'drop',
    disabled: false,
    expiresAt: null,
    maxFiles: 5,
    maxTotalBytes: 1000,
    ...overrides,
  } as Link;
}

describe('dropUploadLimits', () => {
  it('reads the limits of the locked drop', () => {
    expect(dropUploadLimits(now)(drop())).toEqual({
      maxFiles: 5,
      maxLinkBytes: 1000,
      quotaBytes: FILES_STORAGE_QUOTA_BYTES,
    });
  });

  it.each([
    ['missing', null],
    ['disabled', drop({ disabled: true })],
    ['not a drop', drop({ type: 'share' })],
  ])('refuses a %s link with a 404', (_label, link) => {
    expect(() => dropUploadLimits(now)(link)).toThrow(DropNotFoundException);
  });

  it('refuses a drop that expired meanwhile', () => {
    const expired = drop({ expiresAt: new Date('2026-11-10T11:00:00Z') });
    expect(() => dropUploadLimits(now)(expired)).toThrow(DropExpiredException);
  });

  it('fails closed on a null limit', () => {
    expect(() => dropUploadLimits(now)(drop({ maxFiles: null }))).toThrow(
      DropLimitExceededException,
    );
    expect(() => dropUploadLimits(now)(drop({ maxTotalBytes: null }))).toThrow(
      DropLimitExceededException,
    );
  });
});
