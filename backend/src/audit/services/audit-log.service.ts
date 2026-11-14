import { Inject, Injectable, Logger } from '@nestjs/common';
import { AUDIT_LOG_STRING_MAX_LENGTH } from '../../common/variables.global.js';
import type { AuditLogRepository } from '../persistence/audit-log.repository.js';

export type AuditAction =
  | 'auth.login.succeeded'
  | 'auth.login.failed'
  | 'auth.login.locked'
  | 'auth.password.changed'
  | 'settings.updated'
  | 'links.created'
  | 'links.updated'
  | 'links.deleted'
  | 'shares.created'
  | 'shares.updated'
  | 'shares.deleted'
  | 'drops.created'
  | 'drops.updated'
  | 'drops.deleted'
  | 'files.created'
  | 'files.deleted'
  | 'drops.files.shared'
  | 'drops.files.received'
  | 'drops.files.cancelled'
  | 'tags.created'
  | 'tags.updated'
  | 'tags.deleted';

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @Inject('AuditLogsRepository')
    private readonly repository: AuditLogRepository,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repository.create({
        action: entry.action,
        userId: entry.userId ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip?.slice(0, 45) ?? null,
        userAgent:
          entry.userAgent?.slice(0, AUDIT_LOG_STRING_MAX_LENGTH) ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (error) {
      this.logger.error(`Could not record audit entry ${entry.action}`, error);
    }
  }
}
