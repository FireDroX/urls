import {
  EVENTS_RETENTION_DAYS,
  MS_PER_DAY,
} from '../common/variables.global.js';

export function eventsRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - EVENTS_RETENTION_DAYS * MS_PER_DAY);
}
