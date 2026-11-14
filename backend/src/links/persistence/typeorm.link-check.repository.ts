import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkCheck } from '../entities/link-check.entity.js';
import type { LinkCheckResult } from '../link-check-result.js';
import type { LinkCheckRepository } from './link-check.repository.js';

const RECORD_SQL = `INSERT INTO link_checks (link_id, outcome, status_code, error_kind, consecutive_failures, checked_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE consecutive_failures = CASE ? WHEN 'broken' THEN consecutive_failures + 1 WHEN 'ok' THEN 0 ELSE consecutive_failures END, outcome = ?, status_code = ?, error_kind = ?, checked_at = ?`;

@Injectable()
export class TypeormLinkCheckRepository implements LinkCheckRepository {
  constructor(
    @InjectRepository(LinkCheck)
    private readonly repository: Repository<LinkCheck>,
  ) {}

  async record(
    linkId: string,
    result: LinkCheckResult,
    checkedAt: Date,
  ): Promise<LinkCheck> {
    const { outcome, statusCode, errorKind } = result;
    await this.repository.query(RECORD_SQL, [
      linkId,
      outcome,
      statusCode,
      errorKind,
      outcome === 'broken' ? 1 : 0,
      checkedAt,
      outcome,
      outcome,
      statusCode,
      errorKind,
      checkedAt,
    ]);
    return this.repository.findOneByOrFail({ linkId });
  }
}
