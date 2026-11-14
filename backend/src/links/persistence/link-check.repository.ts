import type { LinkCheck } from '../entities/link-check.entity.js';
import type { LinkCheckResult } from '../link-check-result.js';

export interface LinkCheckRepository {
  record(
    linkId: string,
    result: LinkCheckResult,
    checkedAt: Date,
  ): Promise<LinkCheck>;
}
