import type { SelectQueryBuilder } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { Link } from '../entities/link.entity.js';
import {
  dropStateClause,
  findLinkPage,
  linkStateClause,
  shareStateClause,
  type LinkListQuery,
} from './link-list.query.js';

function buildQueryBuilder() {
  const qb = {
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.addOrderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

const NOW = new Date('2026-11-15T00:00:00Z');
const BASE: LinkListQuery = { sort: 'created_desc', page: 1, pageSize: 50 };

async function run(
  query: Partial<LinkListQuery>,
  state: Parameters<typeof findLinkPage>[3] = null,
) {
  const qb = buildQueryBuilder();
  await findLinkPage(
    qb as unknown as SelectQueryBuilder<Link>,
    'redirect',
    { ...BASE, ...query },
    state,
  );
  return qb;
}

describe('findLinkPage', () => {
  it('only filters on the type by default, newest first, first page', async () => {
    const qb = await run({});

    expect(qb.where).toHaveBeenCalledWith('link.type = :type', {
      type: 'redirect',
    });
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(qb.orderBy).toHaveBeenCalledWith('link.createdAt', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('link.publicId', 'ASC');
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(50);
  });

  it('returns the items and the total', async () => {
    const qb = buildQueryBuilder();
    qb.getManyAndCount.mockResolvedValue([[{ id: 'a' }], 42]);

    const result = await findLinkPage(
      qb as unknown as SelectQueryBuilder<Link>,
      'share',
      BASE,
      null,
    );

    expect(result).toEqual({ items: [{ id: 'a' }], total: 42 });
  });

  it('searches slug, destination and title with an escaped, bound pattern', async () => {
    const qb = await run({ q: '50%_!' });

    const [sql, params] = qb.andWhere.mock.calls[0] as [string, object];
    expect(sql).toContain(
      "link.publicId COLLATE utf8mb4_unicode_ci LIKE :pattern ESCAPE '!'",
    );
    expect(sql).toContain("link.destination LIKE :pattern ESCAPE '!'");
    expect(sql).toContain("link.title LIKE :pattern ESCAPE '!'");
    expect(sql).not.toContain('50');
    expect(params).toEqual({ pattern: '%50!%!_!!%' });
  });

  it('filters by tag with a bound parameter', async () => {
    const qb = await run({ tag: 'tag12345' });

    const [sql, params] = qb.andWhere.mock.calls[0] as [string, object];
    expect(sql).toContain('FROM link_tags lt');
    expect(sql).toContain('t.public_id = :tag');
    expect(params).toEqual({ tag: 'tag12345' });
  });

  it('filters by folder', async () => {
    const qb = await run({ folder: 'fold1234' });

    const [sql, params] = qb.andWhere.mock.calls[0] as [string, object];
    expect(sql).toContain('FROM folders f WHERE f.public_id = :folder');
    expect(params).toEqual({ folder: 'fold1234' });
  });

  it('filters links without folder for folder=none', async () => {
    const qb = await run({ folder: 'none' });

    expect(qb.andWhere).toHaveBeenCalledWith('link.folderId IS NULL');
  });

  it('adds the state clause with its parameters', async () => {
    const qb = await run({}, linkStateClause('disabled', NOW));

    expect(qb.andWhere).toHaveBeenCalledWith('(link.disabled = true)', {
      now: NOW,
    });
  });

  it('combines every filter', async () => {
    const qb = await run(
      {
        q: 'a',
        tag: 't',
        folder: 'none',
        sort: 'slug_asc',
        page: 3,
        pageSize: 20,
      },
      linkStateClause('active', NOW),
    );

    expect(qb.andWhere).toHaveBeenCalledTimes(4);
    expect(qb.orderBy).toHaveBeenCalledWith('link.publicId', 'ASC');
    expect(qb.addOrderBy).not.toHaveBeenCalled();
    expect(qb.skip).toHaveBeenCalledWith(40);
    expect(qb.take).toHaveBeenCalledWith(20);
  });

  it.each([
    ['created_asc', 'link.createdAt', 'ASC'],
    ['updated_desc', 'link.updatedAt', 'DESC'],
    ['slug_desc', 'link.publicId', 'DESC'],
  ] as const)('sorts by %s', async (sort, column, order) => {
    const qb = await run({ sort });

    expect(qb.orderBy).toHaveBeenCalledWith(column, order);
  });
});

describe('state clauses', () => {
  it('treats a link as expired once expires_at is reached, like isLinkExpired', () => {
    const { sql, params } = linkStateClause('expired', NOW);
    expect(sql).toBe(
      'link.disabled = false AND link.expiresAt IS NOT NULL AND link.expiresAt <= :now',
    );
    expect(params).toEqual({ now: NOW });
  });

  it('treats a link as active while not expired nor disabled', () => {
    expect(linkStateClause('active', NOW).sql).toBe(
      'link.disabled = false AND (link.expiresAt IS NULL OR link.expiresAt > :now)',
    );
  });

  it('counts an exhausted share as expired, like isLinkUsedUp', () => {
    expect(shareStateClause('expired', NOW).sql).toContain(
      'link.downloadCount >= link.maxDownloads',
    );
    expect(shareStateClause('active', NOW).sql).toContain(
      'NOT (link.maxDownloads IS NOT NULL AND link.downloadCount >= link.maxDownloads)',
    );
    expect(shareStateClause('disabled', NOW).sql).toBe('link.disabled = true');
  });

  it('follows the drop state precedence', () => {
    expect(dropStateClause('disabled', NOW).sql).toBe('link.disabled = true');
    expect(dropStateClause('expired', NOW).sql).toBe(
      'link.disabled = false AND link.expiresAt IS NOT NULL AND link.expiresAt <= :now',
    );
    const full = dropStateClause('full', NOW);
    expect(full.sql).toContain('link.disabled = false');
    expect(full.sql).toContain(
      '(link.expiresAt IS NULL OR link.expiresAt > :now)',
    );
    expect(full.sql).toContain(
      'link.maxFiles IS NULL OR link.maxTotalBytes IS NULL',
    );
    expect(full.sql).toContain('>= link.maxFiles');
    expect(full.sql).toContain('>= link.maxTotalBytes');
    expect(full.sql).toContain(
      'f.status <> :rejected AND f.deleted_at IS NULL',
    );
    expect(full.params).toEqual({ now: NOW, rejected: 'rejected' });
    expect(dropStateClause('open', NOW).sql).toContain(
      'AND NOT (link.maxFiles IS NULL',
    );
  });
});
