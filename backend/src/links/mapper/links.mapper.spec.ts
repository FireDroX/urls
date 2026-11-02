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
});
