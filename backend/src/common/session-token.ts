import type { User } from '../users/entities/user.entity.js';
import { PASSWORD_CHANGE_CLOCK_TOLERANCE_MS } from './variables.global.js';

export interface SessionTokenPayload {
  sub: string;
  type: string;
  iat?: number;
  exp?: number;
}

export function wasIssuedBeforePasswordChange(
  user: Pick<User, 'passwordChangedAt'>,
  issuedAtSeconds: number | undefined,
): boolean {
  if (!user.passwordChangedAt) {
    return false;
  }
  if (issuedAtSeconds === undefined) {
    return true;
  }
  return (
    user.passwordChangedAt.getTime() - PASSWORD_CHANGE_CLOCK_TOLERANCE_MS >
    issuedAtSeconds * 1000
  );
}
