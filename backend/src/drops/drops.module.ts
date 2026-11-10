import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { EventsModule } from '../events/events.module.js';
import { FilesModule } from '../files/files.module.js';
import { Link } from '../links/entities/link.entity.js';
import { DropsController } from './drops.controller.js';
import { TypeormDropRepository } from './persistence/typeorm.drop.repository.js';
import { PublicDropsController } from './public-drops.controller.js';
import { DropsService } from './services/drops.service.js';
import { PublicDropsService } from './services/public-drops.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Link]),
    AuditModule,
    FilesModule,
    EventsModule,
  ],
  controllers: [DropsController, PublicDropsController],
  providers: [
    { provide: 'DropsRepository', useClass: TypeormDropRepository },
    DropsService,
    PublicDropsService,
  ],
})
export class DropsModule {}
