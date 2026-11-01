import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { AccountLockedException } from '../../common/exceptions/auth/account-locked.exception.js';
import { InvalidCredentialsException } from '../../common/exceptions/auth/invalid-credentials.exception.js';
import { InvalidRefreshTokenException } from '../../common/exceptions/auth/invalid-refresh-token.exception.js';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { WeakPasswordException } from '../../common/exceptions/auth/weak-password.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  hashPassword,
  isStrongPassword,
  verifyPassword,
} from '../../common/password.js';
import {
  type SessionTokenPayload,
  wasIssuedBeforePasswordChange,
} from '../../common/session-token.js';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCOUNT_LOCKOUT_DURATION_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
  REFRESH_TOKEN_EXPIRATION,
  SESSION_ACCESS_TOKEN_TYPE,
  SESSION_REFRESH_TOKEN_TYPE,
} from '../../common/variables.global.js';
import { TurnstileService } from '../../security/services/turnstile.service.js';
import type { User } from '../../users/entities/user.entity.js';
import type { UserRepository } from '../../users/persistence/user.repository.js';
import { changePasswordSchema } from '../dto/in/change-password.dto.js';
import { loginSchema } from '../dto/in/login.dto.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private dummyPasswordHash: Promise<string> | null = null;

  constructor(
    @Inject('UsersRepository') private readonly users: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly turnstileService: TurnstileService,
    private readonly auditLog: AuditLogService,
  ) {}

  async login(input: unknown, context: RequestContext): Promise<TokenPair> {
    const dto = parseDto(loginSchema, input);
    if (!(await this.turnstileService.verify(dto.turnstileToken, context.ip))) {
      throw new InvalidTurnstileTokenException();
    }

    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      await verifyPassword(await this.dummyHash(), dto.password);
      await this.recordFailure(null, dto.email, context);
      throw new InvalidCredentialsException();
    }

    await this.ensureNotLocked(user, context);

    if (!(await verifyPassword(user.passwordHash, dto.password))) {
      await this.registerFailedLogin(user, context);
      throw new InvalidCredentialsException();
    }

    if (user.failedLoginAttempts > 0) {
      await this.users.resetFailedLoginAttempts(user.id);
    }
    await this.auditLog.record({
      action: 'auth.login.succeeded',
      userId: user.id,
      ...context,
    });
    return this.generateTokens(user);
  }

  async refresh(refreshToken: string | undefined): Promise<string> {
    if (!refreshToken) {
      throw new InvalidRefreshTokenException();
    }
    const payload = this.verifyRefreshToken(refreshToken);
    const user = await this.users.findById(payload.sub);
    if (!user || wasIssuedBeforePasswordChange(user, payload.iat)) {
      throw new InvalidRefreshTokenException();
    }
    return this.signAccessToken(user);
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new InvalidCredentialsException();
    }
    return user;
  }

  async changePassword(
    userId: string,
    input: unknown,
    context: RequestContext,
  ): Promise<TokenPair> {
    const dto = parseDto(changePasswordSchema, input);
    const user = await this.me(userId);

    if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
      throw new InvalidCredentialsException();
    }
    if (!isStrongPassword(dto.newPassword)) {
      throw new WeakPasswordException();
    }

    const updated = await this.users.updatePassword(
      userId,
      await hashPassword(dto.newPassword),
    );
    await this.auditLog.record({
      action: 'auth.password.changed',
      userId,
      ...context,
    });
    return this.generateTokens(updated);
  }

  private async ensureNotLocked(
    user: User,
    context: RequestContext,
  ): Promise<void> {
    if (!user.lockedUntil) {
      return;
    }
    if (user.lockedUntil.getTime() > Date.now()) {
      await this.auditLog.record({
        action: 'auth.login.locked',
        userId: user.id,
        ...context,
      });
      throw new AccountLockedException(user.lockedUntil);
    }
    await this.users.resetFailedLoginAttempts(user.id);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  private async registerFailedLogin(
    user: User,
    context: RequestContext,
  ): Promise<void> {
    const updated = await this.users.incrementFailedLoginAttempts(user.id);
    await this.recordFailure(user.id, user.email, context);
    if (updated.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await this.users.lockAccount(
        user.id,
        new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION_MINUTES * 60 * 1000),
      );
    }
  }

  private recordFailure(
    userId: string | null,
    email: string,
    context: RequestContext,
  ): Promise<void> {
    return this.auditLog.record({
      action: 'auth.login.failed',
      userId,
      metadata: { email },
      ...context,
    });
  }

  private dummyHash(): Promise<string> {
    this.dummyPasswordHash ??= hashPassword(
      'dummy-password-for-constant-time-login',
    );
    return this.dummyPasswordHash;
  }

  private generateTokens(user: User): TokenPair {
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: this.jwtService.sign(
        { sub: user.id, type: SESSION_REFRESH_TOKEN_TYPE },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: REFRESH_TOKEN_EXPIRATION,
        },
      ),
    };
  }

  private signAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, type: SESSION_ACCESS_TOKEN_TYPE },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_EXPIRATION,
      },
    );
  }

  private verifyRefreshToken(refreshToken: string): SessionTokenPayload {
    let payload: SessionTokenPayload;
    try {
      payload = this.jwtService.verify<SessionTokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new InvalidRefreshTokenException();
    }
    if (payload.type !== SESSION_REFRESH_TOKEN_TYPE) {
      throw new InvalidRefreshTokenException();
    }
    return payload;
  }
}
