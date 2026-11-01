import { describe, expect, it } from 'vitest';
import { hashPassword, isStrongPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes with argon2id and verifies the original password only', async () => {
    const passwordHash = await hashPassword('Correct-Horse-9');

    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(passwordHash, 'Correct-Horse-9')).resolves.toBe(
      true,
    );
    await expect(verifyPassword(passwordHash, 'correct-horse-9')).resolves.toBe(
      false,
    );
  });

  it('answers false instead of throwing on a malformed hash', async () => {
    await expect(verifyPassword('not-a-hash', 'whatever')).resolves.toBe(false);
  });

  it.each([
    ['Correct-Horse-9', true],
    ['Short-9a', false],
    ['nouppercase-9-long', false],
    ['NOLOWERCASE-9-LONG', false],
    ['No-Digits-At-All', false],
    ['NoSymbols9AtAll', false],
  ])('judges %s strong: %s', (password, expected) => {
    expect(isStrongPassword(password)).toBe(expected);
  });
});
