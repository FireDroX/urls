import { describe, expect, it } from 'vitest';
import { isLinkUsedUp } from './link-expiry.js';

const NOW = new Date('2026-11-06T12:00:00Z');
const open = { expiresAt: null, maxDownloads: null, downloadCount: 0 };

describe('isLinkUsedUp', () => {
  it('keeps an unlimited link available', () => {
    expect(isLinkUsedUp({ ...open, downloadCount: 500 }, NOW)).toBe(false);
  });

  it('expires at the exact expiry instant', () => {
    expect(isLinkUsedUp({ ...open, expiresAt: NOW }, NOW)).toBe(true);
    expect(
      isLinkUsedUp({ ...open, expiresAt: new Date(NOW.getTime() + 1) }, NOW),
    ).toBe(false);
  });

  it('is used up once the download limit is reached', () => {
    expect(
      isLinkUsedUp({ ...open, maxDownloads: 3, downloadCount: 2 }, NOW),
    ).toBe(false);
    expect(
      isLinkUsedUp({ ...open, maxDownloads: 3, downloadCount: 3 }, NOW),
    ).toBe(true);
  });
});
