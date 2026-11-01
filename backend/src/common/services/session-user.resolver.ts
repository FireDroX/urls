import { Inject, Injectable } from '@nestjs/common';
import type { UserRepository } from '../../users/persistence/user.repository.js';
import {
  type SessionTokenPayload,
  wasIssuedBeforePasswordChange,
} from '../session-token.js';
import type { AuthenticatedUser } from '../strategies/jwt.strategy.js';
import { SESSION_ACCESS_TOKEN_TYPE } from '../variables.global.js';

@Injectable()
export class SessionUserResolver {
  constructor(
    @Inject('UsersRepository') private readonly userRepository: UserRepository,
  ) {}

  async resolve(
    payload: SessionTokenPayload,
  ): Promise<AuthenticatedUser | null> {
    if (payload.type !== SESSION_ACCESS_TOKEN_TYPE) {
      return null;
    }
    const user = await this.userRepository.findById(payload.sub);
    if (!user || wasIssuedBeforePasswordChange(user, payload.iat)) {
      return null;
    }
    return { id: user.id, email: user.email };
  }
}
