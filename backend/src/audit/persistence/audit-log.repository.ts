import type { AuditLog } from '../entities/audit-log.entity.js';

export type NewAuditLog = Pick<
  AuditLog,
  'action' | 'userId' | 'targetId' | 'ip' | 'userAgent' | 'metadata'
>;

export interface AuditLogRepository {
  create(entry: NewAuditLog): Promise<void>;
}
