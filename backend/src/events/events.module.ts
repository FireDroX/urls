import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkEvent } from './entities/link-event.entity.js';
import { TypeormLinkEventRepository } from './persistence/typeorm.link-event.repository.js';
import { EventsService } from './services/events.service.js';
import { EventsPurgeService } from './services/events-purge.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([LinkEvent])],
  providers: [
    { provide: 'EventsRepository', useClass: TypeormLinkEventRepository },
    EventsService,
    EventsPurgeService,
  ],
  exports: [EventsService],
})
export class EventsModule {}
