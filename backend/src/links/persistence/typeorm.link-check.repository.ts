import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LinkCheck } from '../entities/link-check.entity.js';
import type { LinkCheckResult } from '../link-check-result.js';
import type { LinkCheckRepository } from './link-check.repository.js';

const RECORD_SQL = `INSERT INTO link_checks (link_id, outcome, status_code, error_kind, consecutive_failures, checked_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE consecutive_failures = CASE ? WHEN 'broken' THEN consecutive_failures + 1 WHEN 'ok' THEN 0 ELSE consecutive_failures END, outcome = ?, status_code = ?, error_kind = ?, checked_at = ?`;

const COUNT_BROKEN_SQL = `SELECT COUNT(*) AS total FROM link_checks lc INNER JOIN links l ON l.id = lc.link_id WHERE l.type = 'redirect' AND l.deleted_at IS NULL AND lc.consecutive_failures >= ?`;

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

  async findByLinkIds(linkIds: string[]): Promise<LinkCheck[]> {
    if (linkIds.length === 0) return [];
    return this.repository.findBy({ linkId: In(linkIds) });
  }

  async countBrokenRedirects(brokenAfter: number): Promise<number> {
    const rows = await this.repository.query<{ total: string | number }[]>(
      COUNT_BROKEN_SQL,
      [brokenAfter],
    );
    return Number(rows[0]?.total ?? 0);
  }
}
