import { describe, expect, it, vi } from 'vitest';
import { DefaultAdminConfigurationException } from '../common/exceptions/config/default-admin-configuration.exception.js';
import { verifyPassword } from '../common/password.js';
import {
  defaultAdminSettingsFromEnv,
  ensureDefaultAdmin,
  type DefaultAdminStore,
} from './default-admin.js';

function store(existingUsers: number): DefaultAdminStore & {
  createUser: ReturnType<typeof vi.fn>;
} {
  return {
    countUsers: vi.fn().mockResolvedValue(existingUsers),
    createUser: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ensureDefaultAdmin', () => {
  it('creates the admin with an argon2 hash when no account exists', async () => {
    const users = store(0);

    await expect(
      ensureDefaultAdmin(users, {
        email: 'me@example.org',
        password: 'Correct-Horse-9',
      }),
    ).resolves.toBe('created');

    const created = users.createUser.mock.calls[0][0] as {
      email: string;
      passwordHash: string;
    };
    expect(created.email).toBe('me@example.org');
    await expect(
      verifyPassword(created.passwordHash, 'Correct-Horse-9'),
    ).resolves.toBe(true);
  });

  it('never touches an existing account, even with invalid settings', async () => {
    const users = store(1);

    await expect(ensureDefaultAdmin(users, {})).resolves.toBe(
      'already-present',
    );
    expect(users.createUser.mock.calls).toHaveLength(0);
  });

  it('refuses to create an admin with a weak password', async () => {
    await expect(
      ensureDefaultAdmin(store(0), {
        email: 'me@example.org',
        password: 'weak',
      }),
    ).rejects.toBeInstanceOf(DefaultAdminConfigurationException);
  });

  it('normalises the email read from the environment', () => {
    expect(
      defaultAdminSettingsFromEnv({
        ADMIN_EMAIL: ' Me@Example.org ',
        ADMIN_PASSWORD: '',
      }),
    ).toEqual({ email: 'me@example.org', password: undefined });
  });
});
