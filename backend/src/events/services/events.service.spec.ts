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
  let repository: { insert: ReturnType<typeof vi.fn> };
  let service: EventsService;
  let logError: MockInstance<Logger['error']>;

  function inserted(): NewLinkEvent {
    return repository.insert.mock.calls[0][0] as NewLinkEvent;
  }

  beforeEach(() => {
    repository = { insert: vi.fn().mockResolvedValue(undefined) };
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
      userAgent: 'Mozilla/5.0',
      country: 'FR',
      ipHash: createHmac('sha256', SECRET).update(IP).digest('hex'),
    });
  });

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

    expect(inserted()).toMatchObject({ referer: null, userAgent: null });
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
});
