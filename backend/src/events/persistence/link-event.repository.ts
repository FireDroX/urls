import type { EventType, LinkEvent } from '../entities/link-event.entity.js';

export type NewLinkEvent = Pick<
  LinkEvent,
  | 'linkId'
  | 'type'
  | 'referer'
  | 'refererHost'
  | 'userAgent'
  | 'country'
  | 'ipHash'
>;

export interface DailyClickCount {
  day: string;
  clicks: number;
}

export interface ClickCountByValue {
  value: string | null;
  clicks: number;
}

export interface ClickStatsQuery {
  linkId: string;
  since: Date;
}

export interface LinkEventRepository {
  insert(event: NewLinkEvent): Promise<void>;
  countByType(linkId: string, type: EventType, since: Date): Promise<number>;
  deleteOlderThan(cutoff: Date, limit: number): Promise<number>;
  countClicksByDay(query: ClickStatsQuery): Promise<DailyClickCount[]>;
  topRefererHosts(
    query: ClickStatsQuery,
    limit: number,
  ): Promise<ClickCountByValue[]>;
  topCountries(
    query: ClickStatsQuery,
    limit: number,
  ): Promise<ClickCountByValue[]>;
}
