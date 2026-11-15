import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { EventsModule } from '../events/events.module.js';
import { FilesModule } from '../files/files.module.js';
import { SecurityModule } from '../security/security.module.js';
import { LinksModule } from '../links/links.module.js';
import { Link } from '../links/entities/link.entity.js';
import { DropsController } from './drops.controller.js';
import { TypeormDropRepository } from './persistence/typeorm.drop.repository.js';
import { PublicDropFilesController } from './public-drop-files.controller.js';
import { PublicDropsController } from './public-drops.controller.js';
import { DropUploadsService } from './services/drop-uploads.service.js';
import { DropsService } from './services/drops.service.js';
import { PublicDropsService } from './services/public-drops.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Link]),
    AuditModule,
    LinksModule,
    FilesModule,
    EventsModule,
    SecurityModule,
  ],
  controllers: [
    DropsController,
    PublicDropsController,
    PublicDropFilesController,
  ],
  providers: [
    { provide: 'DropsRepository', useClass: TypeormDropRepository },
    DropsService,
    PublicDropsService,
    DropUploadsService,
  ],
})
export class DropsModule {}
