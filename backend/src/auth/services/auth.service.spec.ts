import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { AccountLockedException } from '../../common/exceptions/auth/account-locked.exception.js';
import { InvalidCredentialsException } from '../../common/exceptions/auth/invalid-credentials.exception.js';
import { InvalidRefreshTokenException } from '../../common/exceptions/auth/invalid-refresh-token.exception.js';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { WeakPasswordException } from '../../common/exceptions/auth/weak-password.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { hashPassword } from '../../common/password.js';
import { MAX_FAILED_LOGIN_ATTEMPTS } from '../../common/variables.global.js';
import type { TurnstileService } from '../../security/services/turnstile.service.js';
import type { User } from '../../users/entities/user.entity.js';
import type { UserRepository } from '../../users/persistence/user.repository.js';
import { AuthService } from './auth.service.js';

const PASSWORD = 'Correct-Horse-9';
const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

let passwordHash: string;

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'me@example.org',
    passwordHash,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let users: { [K in keyof UserRepository]: ReturnType<typeof vi.fn> };
  let turnstile: { verify: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let jwt: JwtService;
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(() => {
    users = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn(),
      incrementFailedLoginAttempts: vi.fn(),
      lockAccount: vi.fn(),
      resetFailedLoginAttempts: vi.fn(),
    };
    turnstile = { verify: vi.fn().mockResolvedValue(true) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    jwt = new JwtService({});
    const config = { get: (key: string) => SECRETS[key] } as ConfigService;
    service = new AuthService(
      users as unknown as UserRepository,
      jwt,
      config,
      turnstile as unknown as TurnstileService,
      audit as unknown as AuditLogService,
    );
  });

  describe('login', () => {
    const context = { ip: '203.0.113.9', userAgent: 'vitest' };

    it('returns an access and a refresh token for valid credentials', async () => {
      users.findByEmail.mockResolvedValue(buildUser());

      const tokens = await service.login(
        { email: ' Me@Example.org ', password: PASSWORD, turnstileToken: 't' },
        context,
      );

      expect(users.findByEmail).toHaveBeenCalledWith('me@example.org');
      expect(
        jwt.verify(tokens.accessToken, { secret: SECRETS.JWT_ACCESS_SECRET }),
      ).toMatchObject({ sub: 'user-1', type: 'access' });
      expect(
        jwt.verify(tokens.refreshToken, {
          secret: SECRETS.JWT_REFRESH_SECRET,
        }),
      ).toMatchObject({ sub: 'user-1', type: 'refresh' });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login.succeeded' }),
      );
    });

    it('passes the client IP to Turnstile and rejects a failed captcha', async () => {
      turnstile.verify.mockResolvedValue(false);

      await expect(
        service.login(
          { email: 'me@example.org', password: PASSWORD, turnstileToken: 't' },
          context,
        ),
      ).rejects.toBeInstanceOf(InvalidTurnstileTokenException);
      expect(turnstile.verify).toHaveBeenCalledWith('t', '203.0.113.9');
      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it.each([
      { email: 'not-an-email', password: PASSWORD },
      { email: 'me@example.org', password: '' },
      { email: 'me@example.org', password: PASSWORD, role: 'admin' },
      null,
    ])('rejects the invalid body %j', async (body) => {
      await expect(service.login(body, context)).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('answers the same error for an unknown email and a wrong password', async () => {
      users.findByEmail.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'x@example.org', password: PASSWORD }, context),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      users.findByEmail.mockResolvedValueOnce(buildUser());
      users.incrementFailedLoginAttempts.mockResolvedValueOnce(
        buildUser({ failedLoginAttempts: 1 }),
      );
      await expect(
        service.login(
          { email: 'me@example.org', password: 'Wrong-9' },
          context,
        ),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it(`locks the account after ${MAX_FAILED_LOGIN_ATTEMPTS} failures`, async () => {
      users.findByEmail.mockResolvedValue(buildUser());
      users.incrementFailedLoginAttempts.mockResolvedValue(
        buildUser({ failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS }),
      );

      await expect(
        service.login(
          { email: 'me@example.org', password: 'Wrong-9' },
          context,
        ),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(users.lockAccount).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
      );
    });

    it('refuses a locked account even with the right password', async () => {
      const lockedUntil = new Date(Date.now() + 60_000);
      users.findByEmail.mockResolvedValue(buildUser({ lockedUntil }));

      await expect(
        service.login({ email: 'me@example.org', password: PASSWORD }, context),
      ).rejects.toBeInstanceOf(AccountLockedException);
    });

    it('resets the counter once the lock has expired', async () => {
      users.findByEmail.mockResolvedValue(
        buildUser({
          lockedUntil: new Date(Date.now() - 1000),
          failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
        }),
      );

      await service.login(
        { email: 'me@example.org', password: PASSWORD },
        context,
      );

      expect(users.resetFailedLoginAttempts).toHaveBeenCalledWith('user-1');
    });
  });

  describe('refresh', () => {
    it('issues a new access token from a valid refresh token', async () => {
      users.findById.mockResolvedValue(buildUser());
      const refreshToken = jwt.sign(
        { sub: 'user-1', type: 'refresh' },
        { secret: SECRETS.JWT_REFRESH_SECRET },
      );

      const accessToken = await service.refresh(refreshToken);

      expect(
        jwt.verify(accessToken, { secret: SECRETS.JWT_ACCESS_SECRET }),
      ).toMatchObject({ sub: 'user-1', type: 'access' });
    });

    it('rejects an access token used as a refresh token', async () => {
      const accessToken = jwt.sign(
        { sub: 'user-1', type: 'access' },
        { secret: SECRETS.JWT_REFRESH_SECRET },
      );

      await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
    });

    it('rejects a refresh token issued before the last password change', async () => {
      const refreshToken = jwt.sign(
        { sub: 'user-1', type: 'refresh', iat: 1_000 },
        { secret: SECRETS.JWT_REFRESH_SECRET },
      );
      users.findById.mockResolvedValue(
        buildUser({ passwordChangedAt: new Date(10_000_000) }),
      );

      await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
    });
  });

  describe('changePassword', () => {
    it('requires the current password', async () => {
      users.findById.mockResolvedValue(buildUser());

      await expect(
        service.changePassword(
          'user-1',
          { currentPassword: 'Wrong-9', newPassword: 'Another-Horse-42' },
          {},
        ),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('rejects a weak new password', async () => {
      users.findById.mockResolvedValue(buildUser());

      await expect(
        service.changePassword(
          'user-1',
          { currentPassword: PASSWORD, newPassword: 'weak' },
          {},
        ),
      ).rejects.toBeInstanceOf(WeakPasswordException);
    });

    it('stores a new hash and returns fresh tokens', async () => {
      users.findById.mockResolvedValue(buildUser());
      users.updatePassword.mockResolvedValue(
        buildUser({ passwordChangedAt: new Date() }),
      );

      const tokens = await service.changePassword(
        'user-1',
        { currentPassword: PASSWORD, newPassword: 'Another-Horse-42' },
        {},
      );

      const [, storedHash] = users.updatePassword.mock.calls[0] as [
        string,
        string,
      ];
      expect(storedHash.startsWith('$argon2id$')).toBe(true);
      expect(tokens.accessToken).toBeTruthy();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.password.changed' }),
      );
    });
  });
});
