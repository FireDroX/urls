import { describe, expect, it } from 'vitest';
import type { Link } from '../entities/link.entity.js';
import { LinksMapper } from './links.mapper.js';

describe('LinksMapper', () => {
  it('exposes the public id and never the internal one', () => {
    const link: Link = {
      id: '0b8f3c1e-1111-4222-8333-944455556666',
      publicId: 'abc123',
      type: 'redirect',
      destination: 'https://example.com/',
      expiresAt: new Date('2999-01-01T00:00:00Z'),
      disabled: false,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-02T00:00:00Z'),
      deletedAt: null,
    };

    const { data } = LinksMapper.toResponse(link);

    expect(data).toEqual({
      id: 'abc123',
      type: 'redirect',
      destination: 'https://example.com/',
      expiresAt: '2999-01-01T00:00:00.000Z',
      disabled: false,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(JSON.stringify(data)).not.toContain(link.id);
  });

  it('redirects with a 302, never a permanent redirect', () => {
    expect(LinksMapper.toRedirect('https://example.com/')).toEqual({
      url: 'https://example.com/',
      statusCode: 302,
    });
  });

  it('maps the click stats with the public id and the UTC time zone', () => {
    const link: Link = {
      id: '0b8f3c1e-1111-4222-8333-944455556666',
      publicId: 'abc123',
      type: 'redirect',
      destination: 'https://example.com/',
      expiresAt: null,
      disabled: false,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
      deletedAt: null,
    };

    const { data } = LinksMapper.toStatsResponse({
      link,
      days: 2,
      clicks: {
        since: '2026-11-01',
        total: 3,
        daily: [
          { day: '2026-11-01', clicks: 0 },
          { day: '2026-11-02', clicks: 3 },
        ],
        referers: [{ value: null, clicks: 3 }],
        countries: [{ value: 'FR', clicks: 3 }],
      },
    });

    expect(data).toEqual({
      id: 'abc123',
      days: 2,
      since: '2026-11-01',
      timeZone: 'UTC',
      total: 3,
      daily: [
        { date: '2026-11-01', clicks: 0 },
        { date: '2026-11-02', clicks: 3 },
      ],
      referers: [{ referer: null, clicks: 3 }],
      countries: [{ country: 'FR', clicks: 3 }],
    });
    expect(JSON.stringify(data)).not.toContain(link.id);
  });
});
