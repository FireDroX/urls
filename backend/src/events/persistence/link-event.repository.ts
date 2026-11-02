import type { LinkEvent } from '../entities/link-event.entity.js';

export type NewLinkEvent = Pick<
  LinkEvent,
  'linkId' | 'type' | 'referer' | 'userAgent' | 'country' | 'ipHash'
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
  countClicksByDay(query: ClickStatsQuery): Promise<DailyClickCount[]>;
  topReferers(
    query: ClickStatsQuery,
    limit: number,
  ): Promise<ClickCountByValue[]>;
  topCountries(
    query: ClickStatsQuery,
    limit: number,
  ): Promise<ClickCountByValue[]>;
}
