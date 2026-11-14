import type {
  LinkCheckErrorKind,
  LinkCheckOutcome,
} from '../common/variables.global.js';

export interface LinkCheckResult {
  outcome: LinkCheckOutcome;
  statusCode: number | null;
  errorKind: LinkCheckErrorKind | null;
}
