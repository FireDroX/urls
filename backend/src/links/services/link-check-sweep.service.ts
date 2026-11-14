import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  LINK_CHECK_BATCH_SIZE,
  LINK_CHECK_CRON,
  LINK_CHECK_DELAY_MS,
} from '../../common/variables.global.js';
import type { Link } from '../entities/link.entity.js';
import { LinkChecksService } from './link-checks.service.js';
import { LinksService } from './links.service.js';

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface LinkCheckSweepSummary {
  checked: number;
  ok: number;
  broken: number;
  skipped: number;
  errors: number;
}

@Injectable()
export class LinkCheckSweepService {
  private readonly logger = new Logger(LinkCheckSweepService.name);
  private running = false;

  constructor(
    private readonly linksService: LinksService,
    private readonly linkChecksService: LinkChecksService,
  ) {}

  @Cron(LINK_CHECK_CRON, { timeZone: 'UTC' })
  async run(): Promise<LinkCheckSweepSummary | null> {
    if (this.running) {
      this.logger.warn('Link check pass skipped: previous pass still running');
      return null;
    }
    this.running = true;
    try {
      const links = await this.linksService.listDueForCheck(
        LINK_CHECK_BATCH_SIZE,
      );
      const summary = await this.checkAll(links);
      this.logger.log(
        `Link check pass done: checked=${summary.checked} ok=${summary.ok} broken=${summary.broken} skipped=${summary.skipped} errors=${summary.errors}`,
      );
      return summary;
    } catch (error) {
      this.logger.error(
        `Link check pass failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
      );
      return null;
    } finally {
      this.running = false;
    }
  }

  private async checkAll(links: Link[]): Promise<LinkCheckSweepSummary> {
    const summary: LinkCheckSweepSummary = {
      checked: 0,
      ok: 0,
      broken: 0,
      skipped: 0,
      errors: 0,
    };
    for (const [index, link] of links.entries()) {
      if (index > 0) await pause(LINK_CHECK_DELAY_MS);
      try {
        const check = await this.linkChecksService.checkLink(link);
        summary.checked++;
        summary[check.outcome]++;
      } catch (error) {
        summary.errors++;
        this.logger.warn(
          `Link check failed for ${link.publicId}: ${error instanceof Error ? error.name : 'UnknownError'}`,
        );
      }
    }
    return summary;
  }
}
