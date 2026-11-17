import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  EVENTS_PURGE_BATCH_SIZE,
  EVENTS_PURGE_CRON,
} from '../../common/variables.global.js';
import { eventsRetentionCutoff } from '../events-retention.js';
import type { LinkEventRepository } from '../persistence/link-event.repository.js';

export interface EventsPurgeSummary {
  deleted: number;
  batches: number;
  durationMs: number;
}

@Injectable()
export class EventsPurgeService {
  private readonly logger = new Logger(EventsPurgeService.name);
  private running = false;

  constructor(
    @Inject('EventsRepository')
    private readonly repository: LinkEventRepository,
  ) {}

  @Cron(EVENTS_PURGE_CRON, { timeZone: 'UTC' })
  async run(now = new Date()): Promise<EventsPurgeSummary | null> {
    if (this.running) {
      this.logger.warn('Events purge skipped: previous pass still running');
      return null;
    }
    this.running = true;
    const start = Date.now();
    let deleted = 0;
    let batches = 0;
    try {
      const cutoff = eventsRetentionCutoff(now);
      let last: number;
      do {
        last = await this.repository.deleteOlderThan(
          cutoff,
          EVENTS_PURGE_BATCH_SIZE,
        );
        deleted += last;
        batches += 1;
      } while (last >= EVENTS_PURGE_BATCH_SIZE);
      const durationMs = Date.now() - start;
      this.logger.log(
        `Events purge done: deleted=${deleted} batches=${batches} durationMs=${durationMs}`,
      );
      return { deleted, batches, durationMs };
    } catch (error) {
      this.logger.error(
        `Events purge failed: ${error instanceof Error ? error.name : 'UnknownError'} deleted=${deleted}`,
      );
      return null;
    } finally {
      this.running = false;
    }
  }
}
