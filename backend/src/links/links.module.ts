import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Folder } from '../folders/entities/folder.entity.js';
import { FoldersModule } from '../folders/folders.module.js';
import { LinkTag } from '../tags/entities/link-tag.entity.js';
import { TagsModule } from '../tags/tags.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { EventsModule } from '../events/events.module.js';
import { FilesModule } from '../files/files.module.js';
import { LinkCheck } from './entities/link-check.entity.js';
import { Link } from './entities/link.entity.js';
import { LinksController } from './links.controller.js';
import { TypeormLinkCheckRepository } from './persistence/typeorm.link-check.repository.js';
import { TypeormLinkOrganizationRepository } from './persistence/typeorm.link-organization.repository.js';
import { TypeormLinkRepository } from './persistence/typeorm.link.repository.js';
import { RedirectsController } from './redirects.controller.js';
import { DestinationProbe } from './services/destination-probe.service.js';
import { LinkCheckSweepService } from './services/link-check-sweep.service.js';
import { LinkChecksService } from './services/link-checks.service.js';
import { LinkOrganizationService } from './services/link-organization.service.js';
import { LinksService } from './services/links.service.js';
import { PinnedHttpTransport } from './services/pinned-http.transport.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Link, LinkCheck, LinkTag, Folder]),
    AuditModule,
    EventsModule,
    TagsModule,
    FoldersModule,
    FilesModule,
  ],
  controllers: [LinksController, RedirectsController],
  providers: [
    { provide: 'LinksRepository', useClass: TypeormLinkRepository },
    { provide: 'LinkChecksRepository', useClass: TypeormLinkCheckRepository },
    {
      provide: 'LinkOrganizationsRepository',
      useClass: TypeormLinkOrganizationRepository,
    },
    PinnedHttpTransport,
    DestinationProbe,
    LinkOrganizationService,
    LinksService,
    LinkChecksService,
    LinkCheckSweepService,
  ],
  exports: [LinkOrganizationService],
})
export class LinksModule {}
