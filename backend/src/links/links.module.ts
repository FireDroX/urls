import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { EventsModule } from '../events/events.module.js';
import { LinkCheck } from './entities/link-check.entity.js';
import { Link } from './entities/link.entity.js';
import { LinksController } from './links.controller.js';
import { TypeormLinkCheckRepository } from './persistence/typeorm.link-check.repository.js';
import { TypeormLinkRepository } from './persistence/typeorm.link.repository.js';
import { RedirectsController } from './redirects.controller.js';
import { DestinationProbe } from './services/destination-probe.service.js';
import { LinkCheckSweepService } from './services/link-check-sweep.service.js';
import { LinkChecksService } from './services/link-checks.service.js';
import { LinksService } from './services/links.service.js';
import { PinnedHttpTransport } from './services/pinned-http.transport.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Link, LinkCheck]),
    AuditModule,
    EventsModule,
  ],
  controllers: [LinksController, RedirectsController],
  providers: [
    { provide: 'LinksRepository', useClass: TypeormLinkRepository },
    { provide: 'LinkChecksRepository', useClass: TypeormLinkCheckRepository },
    PinnedHttpTransport,
    DestinationProbe,
    LinksService,
    LinkChecksService,
    LinkCheckSweepService,
  ],
})
export class LinksModule {}
