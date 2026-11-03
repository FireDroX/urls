import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkEvent } from '../entities/link-event.entity.js';
import { TypeormLinkEventRepository } from './typeorm.link-event.repository.js';

const QUERY = {
  linkId: 'link-uuid',
  since: new Date('2026-10-27T00:00:00.000Z'),
};

function queryBuilder(rows: unknown[]) {
  const builder = {
    select: vi.fn(),
    addSelect: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    limit: vi.fn(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
  for (const method of Object.keys(builder)) {
    if (method !== 'getRawMany') {
      builder[method as keyof typeof builder].mockReturnValue(builder);
    }
  }
  return builder;
}

describe('TypeormLinkEventRepository', () => {
  let builder: ReturnType<typeof queryBuilder>;
  let ormRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormLinkEventRepository;

  function useRows(rows: unknown[]): void {
    builder = queryBuilder(rows);
    ormRepository.createQueryBuilder.mockReturnValue(builder);
  }

  beforeEach(() => {
    ormRepository = {
      create: vi.fn((event: unknown) => event),
      save: vi.fn().mockResolvedValue(undefined),
      createQueryBuilder: vi.fn(),
    };
    repository = new TypeormLinkEventRepository(
      ormRepository as unknown as Repository<LinkEvent>,
    );
    useRows([]);
  });

  it('groups the top sources by referer host in SQL', async () => {
    useRows([
      { bucket: 'news.example', clicks: '2' },
      { bucket: null, clicks: '1' },
    ]);

    const top = await repository.topRefererHosts(QUERY, 10);

    expect(builder.select).toHaveBeenCalledWith('event.refererHost', 'bucket');
    expect(builder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'clicks');
    expect(builder.groupBy).toHaveBeenCalledWith('bucket');
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(top).toEqual([
      { value: 'news.example', clicks: 2 },
      { value: null, clicks: 1 },
    ]);
  });

  it('counts only the clicks of the link within the window', async () => {
    await repository.topRefererHosts(QUERY, 10);

    expect(builder.where).toHaveBeenCalledWith('event.linkId = :linkId', {
      linkId: QUERY.linkId,
    });
    expect(builder.andWhere).toHaveBeenCalledWith('event.type = :type', {
      type: 'click',
    });
    expect(builder.andWhere).toHaveBeenCalledWith('event.createdAt >= :since', {
      since: QUERY.since,
    });
  });

  it('orders the top sources by clicks, then by host', async () => {
    await repository.topRefererHosts(QUERY, 10);

    expect(builder.orderBy).toHaveBeenCalledWith('clicks', 'DESC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('bucket', 'ASC');
  });

  it('groups the top countries by country code', async () => {
    useRows([{ bucket: 'FR', clicks: '3' }]);

    const top = await repository.topCountries(QUERY, 5);

    expect(builder.select).toHaveBeenCalledWith('event.country', 'bucket');
    expect(top).toEqual([{ value: 'FR', clicks: 3 }]);
  });

  it('stores the referer host with the event', async () => {
    const event = {
      linkId: QUERY.linkId,
      type: 'click' as const,
      referer: 'https://news.example/a',
      refererHost: 'news.example',
      userAgent: null,
      country: null,
      ipHash: null,
    };

    await repository.insert(event);

    expect(ormRepository.save).toHaveBeenCalledWith(event);
  });
});
