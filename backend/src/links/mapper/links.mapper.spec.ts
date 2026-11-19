import { describe, expect, it } from 'vitest';
import type { Folder } from '../../folders/entities/folder.entity.js';
import type { Tag } from '../../tags/entities/tag.entity.js';
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
      maxDownloads: null,
      downloadCount: 0,
      title: null,
      maxTotalBytes: null,
      maxFiles: null,
      folderId: null,
      disabled: false,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-02T00:00:00Z'),
      deletedAt: null,
    };

    const { data } = LinksMapper.toResponse({
      link,
      organization: {
        tags: [
          {
            id: 'tag-uuid',
            publicId: 'tag1',
            name: 'Work',
            color: '#112233',
          } as Tag,
        ],
        folder: {
          id: 'folder-uuid',
          publicId: 'fold1',
          name: 'Docs',
        } as Folder,
      },
    });

    expect(data).toEqual({
      id: 'abc123',
      type: 'redirect',
      destination: 'https://example.com/',
      expiresAt: '2999-01-01T00:00:00.000Z',
      disabled: false,
      tags: [{ id: 'tag1', name: 'Work', color: '#112233' }],
      folder: { id: 'fold1', name: 'Docs' },
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(JSON.stringify(data)).not.toContain(link.id);
    expect(JSON.stringify(data)).not.toContain('tag-uuid');
    expect(JSON.stringify(data)).not.toContain('folder-uuid');
  });

  it('maps a check with the public id and an ISO date', () => {
    const { data } = LinksMapper.toCheckResponse({
      link: { id: 'uuid-1', publicId: 'abc123' } as Link,
      check: {
        linkId: 'uuid-1',
        outcome: 'broken',
        statusCode: 404,
        errorKind: null,
        consecutiveFailures: 2,
        checkedAt: new Date('2026-11-14T10:00:00Z'),
      },
    });

    expect(data).toEqual({
      id: 'abc123',
      outcome: 'broken',
      statusCode: 404,
      errorKind: null,
      consecutiveFailures: 2,
      checkedAt: '2026-11-14T10:00:00.000Z',
    });
  });

  it('maps the all-links list without any internal id', () => {
    const { data } = LinksMapper.toAllListResponse({
      items: [
        {
          link: {
            id: 'uuid-drop',
            publicId: 'drop1',
            type: 'drop',
            destination: null,
            title: 'Photos',
            expiresAt: null,
            disabled: false,
            createdAt: new Date('2026-11-01T00:00:00Z'),
            updatedAt: new Date('2026-11-02T00:00:00Z'),
          } as Link,
          organization: { tags: [], folder: null },
          state: 'full',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    expect(data?.items[0]).toEqual({
      type: 'drop',
      id: 'drop1',
      destination: null,
      title: 'Photos',
      state: 'full',
      tags: [],
      folder: null,
      expiresAt: null,
      disabled: false,
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(JSON.stringify(data)).not.toContain('uuid-drop');
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
      maxDownloads: null,
      downloadCount: 0,
      title: null,
      maxTotalBytes: null,
      maxFiles: null,
      folderId: null,
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
        refererHosts: [
          { value: 'news.example', clicks: 2 },
          { value: null, clicks: 1 },
        ],
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
      referers: [
        { host: 'news.example', clicks: 2 },
        { host: null, clicks: 1 },
      ],
      countries: [{ country: 'FR', clicks: 3 }],
    });
    expect(JSON.stringify(data)).not.toContain(link.id);
  });
});
