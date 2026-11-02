import type { LinkEvent } from '../entities/link-event.entity.js';

export type NewLinkEvent = Pick<
  LinkEvent,
  'linkId' | 'type' | 'referer' | 'userAgent' | 'country' | 'ipHash'
>;

export interface LinkEventRepository {
  insert(event: NewLinkEvent): Promise<void>;
}
