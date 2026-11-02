import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { Link } from './entities/link.entity.js';
import { LinksController } from './links.controller.js';
import { TypeormLinkRepository } from './persistence/typeorm.link.repository.js';
import { RedirectsController } from './redirects.controller.js';
import { LinksService } from './services/links.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Link]), AuditModule],
  controllers: [LinksController, RedirectsController],
  providers: [
    { provide: 'LinksRepository', useClass: TypeormLinkRepository },
    LinksService,
  ],
})
export class LinksModule {}
