import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { EventsModule } from '../events/events.module.js';
import { FilesModule } from '../files/files.module.js';
import { Link } from '../links/entities/link.entity.js';
import { SecurityModule } from '../security/security.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { TypeormShareRepository } from './persistence/typeorm.share.repository.js';
import { PublicSharesController } from './public-shares.controller.js';
import { PublicSharesService } from './services/public-shares.service.js';
import { SharesController } from './shares.controller.js';
import { SharesService } from './services/shares.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Link]),
    AuditModule,
    FilesModule,
    EventsModule,
    SecurityModule,
    StorageModule,
  ],
  controllers: [SharesController, PublicSharesController],
  providers: [
    { provide: 'SharesRepository', useClass: TypeormShareRepository },
    SharesService,
    PublicSharesService,
  ],
})
export class SharesModule {}
