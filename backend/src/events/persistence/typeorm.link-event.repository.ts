import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, type SelectQueryBuilder } from 'typeorm';
import { type EventType, LinkEvent } from '../entities/link-event.entity.js';
import type {
  ClickCountByValue,
  ClickStatsQuery,
  DailyClickCount,
  LinkEventRepository,
  NewLinkEvent,
} from './link-event.repository.js';

const CLICK = 'click';
const DAY_BUCKET = "DATE_FORMAT(event.createdAt, '%Y-%m-%d')";

interface CountRow {
  bucket: string | null;
  clicks: string;
}

function affectedRows(result: unknown): number {
  const count = (result as { affectedRows?: unknown } | null)?.affectedRows;
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

@Injectable()
export class TypeormLinkEventRepository implements LinkEventRepository {
  constructor(
    @InjectRepository(LinkEvent)
    private readonly repository: Repository<LinkEvent>,
  ) {}

  async insert(event: NewLinkEvent): Promise<void> {
    await this.repository.save(this.repository.create(event));
  }

  countByType(linkId: string, type: EventType, since: Date): Promise<number> {
    return this.repository.countBy({
      linkId,
      type,
      createdAt: MoreThanOrEqual(since),
    });
  }

  async deleteOlderThan(cutoff: Date, limit: number): Promise<number> {
    if (
      !(cutoff instanceof Date) ||
      !Number.isFinite(cutoff.getTime()) ||
      !Number.isInteger(limit) ||
      limit <= 0
    ) {
      throw new RangeError('Invalid events purge bounds');
    }
    const result: unknown = await this.repository.query(
      'DELETE FROM events WHERE created_at < ? ORDER BY created_at LIMIT ?',
      [cutoff, limit],
    );
    return affectedRows(result);
  }

  async countClicksByDay(query: ClickStatsQuery): Promise<DailyClickCount[]> {
    const rows = await this.countBy(query, DAY_BUCKET)
      .orderBy('bucket', 'ASC')
      .getRawMany<CountRow>();
    return rows.map((row) => ({
      day: String(row.bucket),
      clicks: Number(row.clicks),
    }));
  }

  topRefererHosts(
    query: ClickStatsQuery,
    limit: number,
  ): Promise<ClickCountByValue[]> {
    return this.top(query, 'event.refererHost', limit);
  }

  topCountries(
    query: ClickStatsQuery,
    limit: number,
  ): Promise<ClickCountByValue[]> {
    return this.top(query, 'event.country', limit);
  }

  private async top(
    query: ClickStatsQuery,
    expression: string,
    limit: number,
  ): Promise<ClickCountByValue[]> {
    const rows = await this.countBy(query, expression)
      .orderBy('clicks', 'DESC')
      .addOrderBy('bucket', 'ASC')
      .limit(limit)
      .getRawMany<CountRow>();
    return rows.map((row) => ({
      value: row.bucket,
      clicks: Number(row.clicks),
    }));
  }

  private countBy(
    { linkId, since }: ClickStatsQuery,
    expression: string,
  ): SelectQueryBuilder<LinkEvent> {
    return this.repository
      .createQueryBuilder('event')
      .select(expression, 'bucket')
      .addSelect('COUNT(*)', 'clicks')
      .where('event.linkId = :linkId', { linkId })
      .andWhere('event.type = :type', { type: CLICK })
      .andWhere('event.createdAt >= :since', { since })
      .groupBy('bucket');
  }
}
