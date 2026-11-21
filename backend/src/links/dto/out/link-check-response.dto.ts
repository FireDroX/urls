import type {
  LinkCheckErrorKind,
  LinkCheckOutcome,
} from '../../../common/variables.global.js';

export interface LinkCheckResponseDto {
  id: string;
  outcome: LinkCheckOutcome;
  statusCode: number | null;
  errorKind: LinkCheckErrorKind | null;
  consecutiveFailures: number;
  checkedAt: string;
}
