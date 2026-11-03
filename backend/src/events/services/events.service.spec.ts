import { createHmac } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import {
  EVENT_REFERER_MAX_LENGTH,
  EVENT_USER_AGENT_MAX_LENGTH,
  LINK_STATS_TOP_LIMIT,
} from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import type {
  LinkEventRepository,
  NewLinkEvent,
} from '../persistence/link-event.repository.js';
import { EventsService } from './events.service.js';

const SECRET = 'a'.repeat(32);
const LINK_ID = 'link-uuid';
const IP = '203.0.113.9';

function visitor(overrides: Partial<Visitor> = {}): Visitor {
  return {
    ip: IP,
    referer: 'https://news.example/post',
    userAgent: 'Mozilla/5.0',
    country: 'FR',
    ...overrides,
  };
}

describe('EventsService', () => {
  let repository: {
    insert: ReturnType<typeof vi.fn>;
    countByType: ReturnType<typeof vi.fn>;
    countClicksByDay: ReturnType<typeof vi.fn>;
    topRefererHosts: ReturnType<typeof vi.fn>;
    topCountries: ReturnType<typeof vi.fn>;
  };
  let service: EventsService;
  let logError: MockInstance<Logger['error']>;

  function inserted(): NewLinkEvent {
    return repository.insert.mock.calls[0][0] as NewLinkEvent;
  }

  beforeEach(() => {
    repository = {
      insert: vi.fn().mockResolvedValue(undefined),
      countByType: vi.fn().mockResolvedValue(0),
      countClicksByDay: vi.fn().mockResolvedValue([]),
      topRefererHosts: vi.fn().mockResolvedValue([]),
      topCountries: vi.fn().mockResolvedValue([]),
    };
    const config = { getOrThrow: vi.fn().mockReturnValue(SECRET) };
    service = new EventsService(
      repository as unknown as LinkEventRepository,
      config as unknown as ConfigService,
    );
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a click with the visitor details', async () => {
    await service.recordClick(LINK_ID, visitor());

    expect(inserted()).toEqual({
      linkId: LINK_ID,
      type: 'click',
      referer: 'https://news.example/post',
      refererHost: 'news.example',
      userAgent: 'Mozilla/5.0',
      country: 'FR',
      ipHash: createHmac('sha256', SECRET).update(IP).digest('hex'),
    });
  });

  it('records the same host for two pages of the same site', async () => {
    await service.recordClick(
      LINK_ID,
      visitor({ referer: 'https://news.example/a' }),
    );
    await service.recordClick(
      LINK_ID,
      visitor({ referer: 'https://NEWS.example:443/b' }),
    );

    const hosts = repository.insert.mock.calls.map(
      ([event]) => (event as NewLinkEvent).refererHost,
    );
    expect(hosts).toEqual(['news.example', 'news.example']);
  });

  it.each(['android-app://com.example.app/', 'not a url'])(
    'keeps the raw referer but no host for %s',
    async (referer) => {
      await service.recordClick(LINK_ID, visitor({ referer }));

      expect(inserted()).toMatchObject({ referer, refererHost: null });
    },
  );

  it('stores the IP only as a keyed hash', async () => {
    await service.recordClick(LINK_ID, visitor());

    const event = inserted();
    expect(event.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(event)).not.toContain(IP);
    expect(event.ipHash).not.toBe(
      createHmac('sha256', 'b'.repeat(32)).update(IP).digest('hex'),
    );
  });

  it('stores null when the IP is unknown', async () => {
    await service.recordClick(LINK_ID, visitor({ ip: undefined }));

    expect(inserted().ipHash).toBeNull();
  });

  it('truncates the referer and the user agent', async () => {
    await service.recordClick(
      LINK_ID,
      visitor({
        referer: `https://example.com/${'r'.repeat(EVENT_REFERER_MAX_LENGTH)}`,
        userAgent: 'u'.repeat(EVENT_USER_AGENT_MAX_LENGTH + 10),
      }),
    );

    expect(inserted().referer).toHaveLength(EVENT_REFERER_MAX_LENGTH);
    expect(inserted().userAgent).toHaveLength(EVENT_USER_AGENT_MAX_LENGTH);
  });

  it('stores null for missing or empty referer and user agent', async () => {
    await service.recordClick(
      LINK_ID,
      visitor({ referer: undefined, userAgent: '' }),
    );

    expect(inserted()).toMatchObject({
      referer: null,
      refererHost: null,
      userAgent: null,
    });
  });

  it('normalises a lowercase country code', async () => {
    await service.recordClick(LINK_ID, visitor({ country: ' de ' }));

    expect(inserted().country).toBe('DE');
  });

  it.each([undefined, '', 'XX', 'T1', 'FRA', 'F', '1A', 'F-'])(
    'stores a null country for %s',
    async (country) => {
      await service.recordClick(LINK_ID, visitor({ country }));

      expect(inserted().country).toBeNull();
    },
  );

  it('logs a failed insertion without throwing or logging the IP', async () => {
    repository.insert.mockRejectedValue(new Error('connection lost'));

    await expect(
      service.recordClick(LINK_ID, visitor()),
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logError.mock.calls)).not.toContain(IP);
  });

  it.each([
    ['view', 'recordView'],
    ['download', 'recordDownload'],
  ] as const)(
    'records a %s event with the same visitor details',
    async (type, method) => {
      await service[method](LINK_ID, visitor());

      expect(inserted()).toMatchObject({
        linkId: LINK_ID,
        type,
        refererHost: 'news.example',
        country: 'FR',
        ipHash: createHmac('sha256', SECRET).update(IP).digest('hex'),
      });
    },
  );

  it('counts the views of a link', async () => {
    repository.countByType.mockResolvedValue(7);

    await expect(service.countViews(LINK_ID)).resolves.toBe(7);
    expect(repository.countByType).toHaveBeenCalledWith(LINK_ID, 'view');
  });

  describe('clickStats', () => {
    const NOW = new Date('2026-11-02T15:30:00.000Z');

    it('queries a window starting at UTC midnight, today included', async () => {
      await service.clickStats(LINK_ID, 7, NOW);

      const query = {
        linkId: LINK_ID,
        since: new Date('2026-10-27T00:00:00.000Z'),
      };
      expect(repository.countClicksByDay).toHaveBeenCalledWith(query);
      expect(repository.topRefererHosts).toHaveBeenCalledWith(
        query,
        LINK_STATS_TOP_LIMIT,
      );
      expect(repository.topCountries).toHaveBeenCalledWith(
        query,
        LINK_STATS_TOP_LIMIT,
      );
    });

    it('fills the days without clicks with zero and sums the total', async () => {
      repository.countClicksByDay.mockResolvedValue([
        { day: '2026-10-31', clicks: 4 },
        { day: '2026-11-02', clicks: 2 },
      ]);

      const stats = await service.clickStats(LINK_ID, 4, NOW);

      expect(stats.since).toBe('2026-10-30');
      expect(stats.total).toBe(6);
      expect(stats.daily).toEqual([
        { day: '2026-10-30', clicks: 0 },
        { day: '2026-10-31', clicks: 4 },
        { day: '2026-11-01', clicks: 0 },
        { day: '2026-11-02', clicks: 2 },
      ]);
    });

    it('crosses month and year boundaries', async () => {
      const stats = await service.clickStats(
        LINK_ID,
        3,
        new Date('2027-01-01T00:00:00.000Z'),
      );

      expect(stats.daily.map((entry) => entry.day)).toEqual([
        '2026-12-30',
        '2026-12-31',
        '2027-01-01',
      ]);
    });

    it('returns a single day for a one-day window', async () => {
      const stats = await service.clickStats(LINK_ID, 1, NOW);

      expect(stats.since).toBe('2026-11-02');
      expect(stats.daily).toEqual([{ day: '2026-11-02', clicks: 0 }]);
    });

    it('returns an empty but complete series when there is no click', async () => {
      const stats = await service.clickStats(LINK_ID, 30, NOW);

      expect(stats.total).toBe(0);
      expect(stats.daily).toHaveLength(30);
      expect(stats.daily.every((entry) => entry.clicks === 0)).toBe(true);
      expect(stats.refererHosts).toEqual([]);
      expect(stats.countries).toEqual([]);
    });

    it('passes the top referer hosts and countries through, direct and unknown as null', async () => {
      const refererHosts = [
        { value: null, clicks: 3 },
        { value: 'news.example', clicks: 1 },
      ];
      const countries = [
        { value: 'FR', clicks: 3 },
        { value: null, clicks: 1 },
      ];
      repository.topRefererHosts.mockResolvedValue(refererHosts);
      repository.topCountries.mockResolvedValue(countries);

      const stats = await service.clickStats(LINK_ID, 7, NOW);

      expect(stats.refererHosts).toEqual(refererHosts);
      expect(stats.countries).toEqual(countries);
    });
  });
});
