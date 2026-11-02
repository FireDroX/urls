import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COUNTRY_CODE_REGEX,
  EVENT_REFERER_MAX_LENGTH,
  EVENT_USER_AGENT_MAX_LENGTH,
  IP_HASH_ALGORITHM,
  UNKNOWN_COUNTRY_CODES,
} from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import type { LinkEventRepository } from '../persistence/link-event.repository.js';

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

  async recordClick(linkId: string, visitor: Visitor): Promise<void> {
    try {
      await this.repository.insert({
        linkId,
        type: 'click',
        referer: truncate(visitor.referer, EVENT_REFERER_MAX_LENGTH),
        userAgent: truncate(visitor.userAgent, EVENT_USER_AGENT_MAX_LENGTH),
        country: normalizeCountry(visitor.country),
        ipHash: visitor.ip ? this.hashIp(visitor.ip) : null,
      });
    } catch (error) {
      this.logger.error(
        'Could not record click event',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private hashIp(ip: string): string {
    return createHmac(IP_HASH_ALGORITHM, this.ipHashSecret)
      .update(ip)
      .digest('hex');
  }
}
