import { describe, expect, it } from 'vitest';
import { dropState } from './drop-state.js';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const OPEN = {
  disabled: false,
  expiresAt: null,
  maxFiles: 3,
  maxTotalBytes: 1000,
};
const EMPTY = { fileCount: 0, totalSize: 0 };

describe('dropState', () => {
  it('is open under both limits', () => {
    expect(dropState(OPEN, { fileCount: 2, totalSize: 999 }, NOW)).toBe('open');
  });

  it('is open before its expiry', () => {
    const expiresAt = new Date(NOW.getTime() + 1);
    expect(dropState({ ...OPEN, expiresAt }, EMPTY, NOW)).toBe('open');
  });

  it('is expired at the exact expiry instant', () => {
    expect(dropState({ ...OPEN, expiresAt: NOW }, EMPTY, NOW)).toBe('expired');
  });

  it('is full when the file count reaches the limit', () => {
    expect(dropState(OPEN, { fileCount: 3, totalSize: 0 }, NOW)).toBe('full');
  });

  it('is full when no byte is left', () => {
    expect(dropState(OPEN, { fileCount: 1, totalSize: 1000 }, NOW)).toBe(
      'full',
    );
  });

  it('is full when usage exceeds a lowered limit', () => {
    expect(dropState(OPEN, { fileCount: 9, totalSize: 5000 }, NOW)).toBe(
      'full',
    );
  });

  it('is disabled', () => {
    expect(dropState({ ...OPEN, disabled: true }, EMPTY, NOW)).toBe('disabled');
  });

  it.each([
    ['maxFiles', { maxFiles: null }],
    ['maxTotalBytes', { maxTotalBytes: null }],
  ])('fails closed when %s is null', (_name, limits) => {
    expect(dropState({ ...OPEN, ...limits }, EMPTY, NOW)).toBe('full');
  });

  describe('precedence', () => {
    const expiresAt = new Date(NOW.getTime() - 1);
    const fullUsage = { fileCount: 3, totalSize: 1000 };

    it('disabled wins over expired', () => {
      expect(
        dropState({ ...OPEN, disabled: true, expiresAt }, EMPTY, NOW),
      ).toBe('disabled');
    });

    it('disabled wins over full', () => {
      expect(dropState({ ...OPEN, disabled: true }, fullUsage, NOW)).toBe(
        'disabled',
      );
    });

    it('expired wins over full', () => {
      expect(dropState({ ...OPEN, expiresAt }, fullUsage, NOW)).toBe('expired');
    });
  });
});
