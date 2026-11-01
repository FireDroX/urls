import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { TypeormAuditLogRepository } from './persistence/typeorm.audit-log.repository.js';
import { AuditLogService } from './services/audit-log.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    { provide: 'AuditLogsRepository', useClass: TypeormAuditLogRepository },
    AuditLogService,
  ],
  exports: [AuditLogService],
})
export class AuditModule {}
