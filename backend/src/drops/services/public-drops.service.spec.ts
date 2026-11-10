import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DropExpiredException } from '../../common/exceptions/drops/drop-expired.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { LINK_SLUG_MAX_LENGTH } from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import type { EventsService } from '../../events/services/events.service.js';
import type { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import { DropsMapper } from '../mapper/drops.mapper.js';
import type { DropRepository } from '../persistence/drop.repository.js';
import { PublicDropsService } from './public-drops.service.js';

const VISITOR: Visitor = {
  ip: '203.0.113.9',
  referer: undefined,
  userAgent: 'Mozilla/5.0',
  country: 'FR',
};

function buildDrop(overrides: Partial<Link> = {}): Link {
  return {
    id: 'drop-uuid',
    publicId: 'drop1234',
    type: 'drop',
    destination: null,
    expiresAt: null,
    maxDownloads: null,
    downloadCount: 0,
    title: 'Photos du week-end',
    maxTotalBytes: 1000,
    maxFiles: 5,
    disabled: false,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('PublicDropsService', () => {
  let repository: { findByPublicId: ReturnType<typeof vi.fn> };
  let files: { summarizeCountedLinks: ReturnType<typeof vi.fn> };
  let events: { recordView: ReturnType<typeof vi.fn> };
  let service: PublicDropsService;

  function useUsage(fileCount: number, totalSize: number): void {
    files.summarizeCountedLinks.mockResolvedValue(
      new Map([['drop-uuid', { fileCount, totalSize }]]),
    );
  }

  beforeEach(() => {
    repository = { findByPublicId: vi.fn().mockResolvedValue(buildDrop()) };
    files = { summarizeCountedLinks: vi.fn().mockResolvedValue(new Map()) };
    events = { recordView: vi.fn().mockResolvedValue(undefined) };
    service = new PublicDropsService(
      repository as unknown as DropRepository,
      files as unknown as FilesService,
      events as unknown as EventsService,
    );
  });

  it('computes the remaining room from the counted files', async () => {
    useUsage(2, 400);

    const result = await service.view('drop1234', VISITOR);

    expect(files.summarizeCountedLinks).toHaveBeenCalledWith(['drop-uuid']);
    expect(result).toMatchObject({ filesRemaining: 3, bytesRemaining: 600 });
  });

  it('offers the whole limits to an empty drop', async () => {
    await expect(service.view('drop1234', VISITOR)).resolves.toMatchObject({
      filesRemaining: 5,
      bytesRemaining: 1000,
    });
  });

  it('records a view without waiting for it', async () => {
    events.recordView.mockReturnValue(new Promise(() => undefined));

    await expect(service.view('drop1234', VISITOR)).resolves.toBeDefined();
    expect(events.recordView).toHaveBeenCalledWith('drop-uuid', VISITOR);
  });

  it.each([
    [
      'an unknown, deleted or other type of link',
      () => repository.findByPublicId.mockResolvedValue(null),
    ],
    [
      'a disabled drop',
      () =>
        repository.findByPublicId.mockResolvedValue(
          buildDrop({ disabled: true }),
        ),
    ],
  ])('answers the same not found for %s', async (_label, arrange) => {
    arrange();

    await expect(service.view('drop1234', VISITOR)).rejects.toEqual(
      new DropNotFoundException(),
    );
    expect(events.recordView).not.toHaveBeenCalled();
    expect(files.summarizeCountedLinks).not.toHaveBeenCalled();
  });

  it('does not tell a disabled expired drop from a missing one', async () => {
    repository.findByPublicId.mockResolvedValue(
      buildDrop({ disabled: true, expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(service.view('drop1234', VISITOR)).rejects.toEqual(
      new DropNotFoundException(),
    );
  });

  it.each(['bad id!', 'a'.repeat(LINK_SLUG_MAX_LENGTH + 1), '../api'])(
    'rejects the malformed id %s before querying the database',
    async (id) => {
      await expect(service.view(id, VISITOR)).rejects.toEqual(
        new DropNotFoundException(),
      );
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'past its expiration date',
      { expiresAt: new Date(Date.now() - 1000) },
      [0, 0],
    ],
    ['at its file limit', {}, [5, 10]],
    ['beyond its file limit', {}, [7, 10]],
    ['at its byte limit', {}, [1, 1000]],
    ['beyond its byte limit', {}, [1, 1500]],
    ['without limits', { maxFiles: null, maxTotalBytes: null }, [0, 0]],
  ])('answers expired for a drop %s', async (_label, overrides, usage) => {
    repository.findByPublicId.mockResolvedValue(buildDrop(overrides));
    useUsage(usage[0], usage[1]);

    await expect(service.view('drop1234', VISITOR)).rejects.toEqual(
      new DropExpiredException(),
    );
    expect(events.recordView).not.toHaveBeenCalled();
  });

  it('serves a drop one file and one byte below its limits', async () => {
    useUsage(4, 999);

    await expect(service.view('drop1234', VISITOR)).resolves.toMatchObject({
      filesRemaining: 1,
      bytesRemaining: 1,
    });
  });
});

describe('DropsMapper.toPublicResponse', () => {
  it('exposes only the public fields', () => {
    const response = DropsMapper.toPublicResponse({
      drop: buildDrop({ expiresAt: new Date('2027-01-01T00:00:00Z') }),
      filesRemaining: 3,
      bytesRemaining: 600,
    });

    expect(response.data).toEqual({
      id: 'drop1234',
      title: 'Photos du week-end',
      maxFiles: 5,
      maxTotalBytes: 1000,
      filesRemaining: 3,
      bytesRemaining: 600,
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
  });
});
