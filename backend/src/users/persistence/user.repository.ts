import type { User } from '../entities/user.entity.js';

export interface NewUser {
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  count(): Promise<number>;
  create(data: NewUser): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<User>;
  incrementFailedLoginAttempts(id: string): Promise<User>;
  lockAccount(id: string, lockedUntil: Date): Promise<void>;
  resetFailedLoginAttempts(id: string): Promise<void>;
}
