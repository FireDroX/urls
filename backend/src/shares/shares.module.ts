import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { FilesModule } from '../files/files.module.js';
import { Link } from '../links/entities/link.entity.js';
import { TypeormShareRepository } from './persistence/typeorm.share.repository.js';
import { SharesController } from './shares.controller.js';
import { SharesService } from './services/shares.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Link]), AuditModule, FilesModule],
  controllers: [SharesController],
  providers: [
    { provide: 'SharesRepository', useClass: TypeormShareRepository },
    SharesService,
  ],
})
export class SharesModule {}
