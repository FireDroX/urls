import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkCheck } from '../entities/link-check.entity.js';
import type { LinkCheckResult } from '../link-check-result.js';
import { TypeormLinkCheckRepository } from './typeorm.link-check.repository.js';

const LINK_ID = 'link-uuid';
const CHECKED_AT = new Date('2026-11-14T10:00:00.000Z');

describe('TypeormLinkCheckRepository', () => {
  let ormRepository: {
    query: ReturnType<typeof vi.fn>;
    findOneByOrFail: ReturnType<typeof vi.fn>;
    findBy: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormLinkCheckRepository;

  const sentSql = () => ormRepository.query.mock.calls[0][0] as string;
  const sentParams = () => ormRepository.query.mock.calls[0][1] as unknown[];

  beforeEach(() => {
    ormRepository = {
      query: vi.fn().mockResolvedValue(undefined),
      findOneByOrFail: vi.fn(),
      findBy: vi.fn().mockResolvedValue([]),
    };
    repository = new TypeormLinkCheckRepository(
      ormRepository as unknown as Repository<LinkCheck>,
    );
  });

  it('writes the check in a single upsert statement', async () => {
    await repository.record(
      LINK_ID,
      { outcome: 'ok', statusCode: 200, errorKind: null },
      CHECKED_AT,
    );

    expect(ormRepository.query).toHaveBeenCalledTimes(1);
    expect(sentSql()).toContain('INSERT INTO link_checks');
    expect(sentSql()).toContain('ON DUPLICATE KEY UPDATE');
  });

  it('updates the failure counter by outcome on an existing row', async () => {
    await repository.record(
      LINK_ID,
      { outcome: 'ok', statusCode: 200, errorKind: null },
      CHECKED_AT,
    );

    expect(sentSql()).toContain(
      "consecutive_failures = CASE ? WHEN 'broken' THEN consecutive_failures + 1 WHEN 'ok' THEN 0 ELSE consecutive_failures END",
    );
  });

  it.each<[string, LinkCheckResult, number]>([
    ['broken', { outcome: 'broken', statusCode: 404, errorKind: null }, 1],
    ['ok', { outcome: 'ok', statusCode: 200, errorKind: null }, 0],
    ['skipped', { outcome: 'skipped', statusCode: null, errorKind: null }, 0],
  ])(
    'sends the parameters for a %s check, first insert counting %i',
    async (_label, result, firstInsertFailures) => {
      await repository.record(LINK_ID, result, CHECKED_AT);

      expect(sentParams()).toEqual([
        LINK_ID,
        result.outcome,
        result.statusCode,
        result.errorKind,
        firstInsertFailures,
        CHECKED_AT,
        result.outcome,
        result.outcome,
        result.statusCode,
        result.errorKind,
        CHECKED_AT,
      ]);
    },
  );

  it('passes the error kind of a broken check without status code', async () => {
    await repository.record(
      LINK_ID,
      { outcome: 'broken', statusCode: null, errorKind: 'dns' },
      CHECKED_AT,
    );

    expect(sentParams().slice(1, 5)).toEqual(['broken', null, 'dns', 1]);
  });

  it('returns the row read back after the upsert', async () => {
    const row = {
      linkId: LINK_ID,
      outcome: 'broken',
      statusCode: 500,
      errorKind: null,
      consecutiveFailures: 3,
      checkedAt: CHECKED_AT,
    };
    ormRepository.findOneByOrFail.mockResolvedValue(row);

    const saved = await repository.record(
      LINK_ID,
      { outcome: 'broken', statusCode: 500, errorKind: null },
      CHECKED_AT,
    );

    expect(ormRepository.findOneByOrFail).toHaveBeenCalledWith({
      linkId: LINK_ID,
    });
    expect(saved).toBe(row);
  });

  it('does not query for an empty list of links', async () => {
    expect(await repository.findByLinkIds([])).toEqual([]);
    expect(ormRepository.findBy).not.toHaveBeenCalled();
  });

  it('reads the checks of several links in one query', async () => {
    const rows = [{ linkId: 'a' }, { linkId: 'b' }];
    ormRepository.findBy.mockResolvedValue(rows);

    expect(await repository.findByLinkIds(['a', 'b'])).toBe(rows);
    expect(ormRepository.findBy).toHaveBeenCalledTimes(1);
  });

  it('counts the broken redirects not deleted, with a bound threshold', async () => {
    ormRepository.query.mockResolvedValue([{ total: '3' }]);

    expect(await repository.countBrokenRedirects(2)).toBe(3);
    expect(sentSql()).toContain("l.type = 'redirect'");
    expect(sentSql()).toContain('l.deleted_at IS NULL');
    expect(sentSql()).toContain('lc.consecutive_failures >= ?');
    expect(sentParams()).toEqual([2]);
  });
});
