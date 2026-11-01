import { hash, verify } from '@node-rs/argon2';
import {
  KNOWN_DEFAULT_SECRETS,
  MIN_PASSWORD_LENGTH,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MAX_LENGTH,
} from './variables.global.js';

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    PASSWORD_COMPLEXITY_REGEX.test(password) &&
    !KNOWN_DEFAULT_SECRETS.includes(password.trim().toLowerCase())
  );
}
