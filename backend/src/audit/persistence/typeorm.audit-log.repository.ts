import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity.js';
import type {
  AuditLogRepository,
  NewAuditLog,
} from './audit-log.repository.js';

@Injectable()
export class TypeormAuditLogRepository implements AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  async create(entry: NewAuditLog): Promise<void> {
    await this.repository.save(this.repository.create(entry));
  }
}
