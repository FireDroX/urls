import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import type { NewUser, UserRepository } from './user.repository.js';

@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  count(): Promise<number> {
    return this.repository.count();
  }

  create(data: NewUser): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    await this.repository.update(id, {
      passwordHash,
      passwordChangedAt: new Date(),
    });
    return (await this.findById(id))!;
  }

  async incrementFailedLoginAttempts(id: string): Promise<User> {
    await this.repository.increment({ id }, 'failedLoginAttempts', 1);
    return (await this.findById(id))!;
  }

  async lockAccount(id: string, lockedUntil: Date): Promise<void> {
    await this.repository.update(id, { lockedUntil });
  }

  async resetFailedLoginAttempts(id: string): Promise<void> {
    await this.repository.update(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }
}
