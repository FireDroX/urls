import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { FilesModule } from '../files/files.module.js';
import { Link } from '../links/entities/link.entity.js';
import { TypeormShareRepository } from './persistence/typeorm.share.repository.js';
import { ShareFilesController } from './share-files.controller.js';
import { SharesController } from './shares.controller.js';
import { ShareFilesService } from './services/share-files.service.js';
import { SharesService } from './services/shares.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Link]), AuditModule, FilesModule],
  controllers: [SharesController, ShareFilesController],
  providers: [
    { provide: 'SharesRepository', useClass: TypeormShareRepository },
    SharesService,
    ShareFilesService,
  ],
})
export class SharesModule {}
