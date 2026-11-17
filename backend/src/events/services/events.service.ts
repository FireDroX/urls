import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COUNTRY_CODE_REGEX,
  EVENT_REFERER_MAX_LENGTH,
  EVENT_USER_AGENT_MAX_LENGTH,
  IP_HASH_ALGORITHM,
  LINK_STATS_TOP_LIMIT,
  MS_PER_DAY,
  UNKNOWN_COUNTRY_CODES,
} from '../../common/variables.global.js';
import { refererHost } from '../../common/referer-host.js';
import { eventsRetentionCutoff } from '../events-retention.js';
import type { Visitor } from '../../common/visitor.js';
import type { EventType } from '../entities/link-event.entity.js';
import type {
  ClickCountByValue,
  DailyClickCount,
  LinkEventRepository,
} from '../persistence/link-event.repository.js';

export interface LinkClickStats {
  since: string;
  total: number;
  daily: DailyClickCount[];
  refererHosts: ClickCountByValue[];
  countries: ClickCountByValue[];
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function firstDayOfWindow(days: number, now: Date): Date {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(today - (days - 1) * MS_PER_DAY);
}

function fillMissingDays(
  since: Date,
  days: number,
  counts: DailyClickCount[],
): DailyClickCount[] {
  const clicksByDay = new Map(counts.map((count) => [count.day, count.clicks]));
  return Array.from({ length: days }, (_, offset) => {
    const day = utcDay(new Date(since.getTime() + offset * MS_PER_DAY));
    return { day, clicks: clicksByDay.get(day) ?? 0 };
  });
}

function truncate(value: string | undefined, maxLength: number): string | null {
  return value ? value.slice(0, maxLength) : null;
}

function normalizeCountry(value: string | undefined): string | null {
  const code = value?.trim().toUpperCase();
  if (
    !code ||
    !COUNTRY_CODE_REGEX.test(code) ||
    UNKNOWN_COUNTRY_CODES.includes(code)
  ) {
    return null;
  }
  return code;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly ipHashSecret: string;

  constructor(
    @Inject('EventsRepository')
    private readonly repository: LinkEventRepository,
    configService: ConfigService,
  ) {
    this.ipHashSecret = configService.getOrThrow<string>('IP_HASH_SECRET');
  }

  recordClick(linkId: string, visitor: Visitor): Promise<void> {
    return this.record(linkId, 'click', visitor);
  }

  recordView(linkId: string, visitor: Visitor): Promise<void> {
    return this.record(linkId, 'view', visitor);
  }

  recordUpload(linkId: string, visitor: Visitor): Promise<void> {
    return this.record(linkId, 'upload', visitor);
  }

  recordDownload(linkId: string, visitor: Visitor): Promise<void> {
    return this.record(linkId, 'download', visitor);
  }

  countViews(linkId: string, now = new Date()): Promise<number> {
    return this.repository.countByType(
      linkId,
      'view',
      eventsRetentionCutoff(now),
    );
  }

  private async record(
    linkId: string,
    type: EventType,
    visitor: Visitor,
  ): Promise<void> {
    try {
      await this.repository.insert({
        linkId,
        type,
        referer: truncate(visitor.referer, EVENT_REFERER_MAX_LENGTH),
        refererHost: refererHost(visitor.referer),
        userAgent: truncate(visitor.userAgent, EVENT_USER_AGENT_MAX_LENGTH),
        country: normalizeCountry(visitor.country),
        ipHash: visitor.ip ? this.hashIp(visitor.ip) : null,
      });
    } catch (error) {
      this.logger.error(
        `Could not record ${type} event`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async clickStats(
    linkId: string,
    days: number,
    now = new Date(),
  ): Promise<LinkClickStats> {
    const since = firstDayOfWindow(days, now);
    const query = { linkId, since };
    const [counts, refererHosts, countries] = await Promise.all([
      this.repository.countClicksByDay(query),
      this.repository.topRefererHosts(query, LINK_STATS_TOP_LIMIT),
      this.repository.topCountries(query, LINK_STATS_TOP_LIMIT),
    ]);
    const daily = fillMissingDays(since, days, counts);
    return {
      since: utcDay(since),
      total: daily.reduce((sum, day) => sum + day.clicks, 0),
      daily,
      refererHosts,
      countries,
    };
  }

  private hashIp(ip: string): string {
    return createHmac(IP_HASH_ALGORITHM, this.ipHashSecret)
      .update(ip)
      .digest('hex');
  }
}
