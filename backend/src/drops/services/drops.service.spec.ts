import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  DROP_TITLE_MAX_LENGTH,
  FILES_STORAGE_QUOTA_BYTES,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  PUBLIC_ID_LENGTH,
  SHARE_FILES_MAX,
} from '../../common/variables.global.js';
import type { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import { DropsMapper } from '../mapper/drops.mapper.js';
import type {
  DropRepository,
  NewDrop,
} from '../persistence/drop.repository.js';
import { DropsService } from './drops.service.js';

const USER_ID = 'user-1';
const FUTURE = '2999-01-01T00:00:00.000Z';
const LIMITS = { maxFiles: 5, maxTotalBytes: 1000 };

function buildDrop(overrides: Partial<Link> = {}): Link {
  return {
    id: 'drop-uuid',
    publicId: 'drop1234',
    type: 'drop',
    destination: null,
    title: null,
    expiresAt: null,
    maxDownloads: null,
    downloadCount: 0,
    maxTotalBytes: 1000,
    maxFiles: 5,
    disabled: false,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('DropsService', () => {
  let repository: {
    findAll: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let files: { summarizeCountedLinks: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: DropsService;

  beforeEach(() => {
    repository = {
      findAll: vi.fn().mockResolvedValue([]),
      findByPublicId: vi.fn().mockResolvedValue(null),
      insert: vi.fn((drop: NewDrop) => Promise.resolve(buildDrop({ ...drop }))),
      save: vi.fn((drop: Link) => Promise.resolve(drop)),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    files = { summarizeCountedLinks: vi.fn().mockResolvedValue(new Map()) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new DropsService(
      repository as unknown as DropRepository,
      files as unknown as FilesService,
      audit as unknown as AuditLogService,
    );
  });

  describe('list', () => {
    it('aggregates every drop in one call and sets the state', async () => {
      const first = buildDrop({ id: 'a', publicId: 'first' });
      const second = buildDrop({ id: 'b', publicId: 'second', disabled: true });
      repository.findAll.mockResolvedValue([first, second]);
      files.summarizeCountedLinks.mockResolvedValue(
        new Map([['a', { fileCount: 5, totalSize: 10 }]]),
      );

      const summaries = await service.list();

      expect(files.summarizeCountedLinks).toHaveBeenCalledTimes(1);
      expect(files.summarizeCountedLinks).toHaveBeenCalledWith(['a', 'b']);
      expect(summaries).toEqual([
        { drop: first, fileCount: 5, totalSize: 10, state: 'full' },
        { drop: second, fileCount: 0, totalSize: 0, state: 'disabled' },
      ]);
    });
  });

  describe('get', () => {
    it('returns the drop with its usage and state', async () => {
      const drop = buildDrop();
      repository.findByPublicId.mockResolvedValue(drop);
      files.summarizeCountedLinks.mockResolvedValue(
        new Map([['drop-uuid', { fileCount: 1, totalSize: 1000 }]]),
      );

      await expect(service.get('drop1234')).resolves.toEqual({
        drop,
        fileCount: 1,
        totalSize: 1000,
        state: 'full',
      });
    });

    it('is expired once its date has passed', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildDrop({ expiresAt: new Date('2000-01-01T00:00:00Z') }),
      );

      await expect(service.get('drop1234')).resolves.toMatchObject({
        state: 'expired',
      });
    });

    it('is open under its limits', async () => {
      repository.findByPublicId.mockResolvedValue(buildDrop());

      await expect(service.get('drop1234')).resolves.toMatchObject({
        state: 'open',
      });
    });
  });

  describe('create', () => {
    it('uses the chosen slug', async () => {
      const summary = await service.create(
        { slug: 'my-drop', title: ' Photos ', ...LIMITS },
        USER_ID,
      );

      expect(repository.insert).toHaveBeenCalledWith({
        publicId: 'my-drop',
        title: 'Photos',
        expiresAt: null,
        ...LIMITS,
      });
      expect(summary).toMatchObject({
        fileCount: 0,
        totalSize: 0,
        state: 'open',
      });
      expect(audit.record).toHaveBeenCalledWith({
        action: 'drops.created',
        userId: USER_ID,
        targetId: 'my-drop',
        metadata: {
          title: 'Photos',
          expiresAt: null,
          ...LIMITS,
        },
      });
    });

    it('generates a public id without a slug', async () => {
      await service.create({ ...LIMITS, expiresAt: FUTURE }, USER_ID);

      const [inserted] = repository.insert.mock.calls[0] as [NewDrop];
      expect(inserted.publicId).toHaveLength(PUBLIC_ID_LENGTH);
      expect(inserted.expiresAt).toEqual(new Date(FUTURE));
      expect(inserted.title).toBeNull();
    });

    it('answers a conflict on an explicit slug', async () => {
      repository.insert.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.create({ slug: 'taken', ...LIMITS }, USER_ID),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(repository.insert).toHaveBeenCalledTimes(1);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('retries a generated id that is taken', async () => {
      repository.insert.mockRejectedValueOnce(new SlugAlreadyTakenException());

      await service.create(LIMITS, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(2);
    });

    it('gives up after too many collisions', async () => {
      repository.insert.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(service.create(LIMITS, USER_ID)).rejects.toBeInstanceOf(
        SlugAlreadyTakenException,
      );
      expect(repository.insert).toHaveBeenCalledTimes(
        PUBLIC_ID_GENERATION_ATTEMPTS,
      );
    });

    it.each([
      ['maxFiles missing', { maxTotalBytes: 10 }],
      ['maxTotalBytes missing', { maxFiles: 1 }],
      ['maxFiles null', { maxFiles: null, maxTotalBytes: 10 }],
      ['maxTotalBytes null', { maxFiles: 1, maxTotalBytes: null }],
      ['unknown key', { ...LIMITS, destination: 'https://example.com' }],
      [
        'title too long',
        { ...LIMITS, title: 'a'.repeat(DROP_TITLE_MAX_LENGTH + 1) },
      ],
      ['blank title', { ...LIMITS, title: '   ' }],
      ['control character in title', { ...LIMITS, title: 'a\u0007b' }],
      ['expiry in the past', { ...LIMITS, expiresAt: '2000-01-01T00:00:00Z' }],
    ])('rejects %s with a 400', async (_case, body) => {
      await expect(service.create(body, USER_ID)).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('accepts a null title', async () => {
      await service.create({ ...LIMITS, title: null }, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['maxFiles', SHARE_FILES_MAX],
      ['maxTotalBytes', FILES_STORAGE_QUOTA_BYTES],
    ])('accepts %s at its upper bound and 1', async (field, max) => {
      await service.create({ ...LIMITS, [field]: max }, USER_ID);
      await service.create({ ...LIMITS, [field]: 1 }, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['maxFiles', 0],
      ['maxFiles', SHARE_FILES_MAX + 1],
      ['maxFiles', 1.5],
      ['maxFiles', '3'],
      ['maxTotalBytes', 0],
      ['maxTotalBytes', FILES_STORAGE_QUOTA_BYTES + 1],
      ['maxTotalBytes', 1.5],
      ['maxTotalBytes', -1],
    ])('rejects %s = %s', async (field, value) => {
      await expect(
        service.create({ ...LIMITS, [field]: value }, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repository.findByPublicId.mockResolvedValue(
        buildDrop({ title: 'Old', expiresAt: new Date(FUTURE) }),
      );
    });

    it.each([
      ['slug', { slug: 'new-slug' }, { publicId: 'new-slug' }],
      ['title', { title: 'New' }, { title: 'New' }],
      ['cleared title', { title: null }, { title: null }],
      [
        'expiry',
        { expiresAt: '2998-01-01T00:00:00.000Z' },
        { expiresAt: new Date('2998-01-01T00:00:00.000Z') },
      ],
      ['cleared expiry', { expiresAt: null }, { expiresAt: null }],
      ['maxFiles', { maxFiles: 9 }, { maxFiles: 9 }],
      ['maxTotalBytes', { maxTotalBytes: 42 }, { maxTotalBytes: 42 }],
      ['disabled', { disabled: true }, { disabled: true }],
    ])('changes the %s', async (_field, body, expected) => {
      await service.update('drop1234', body, USER_ID);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining(expected),
      );
      expect(audit.record).toHaveBeenCalledWith({
        action: 'drops.updated',
        userId: USER_ID,
        targetId: (expected as { publicId?: string }).publicId ?? 'drop1234',
        metadata: {
          previousId: 'drop1234',
          changes: expect.any(Object) as unknown,
        },
      });
    });

    it('lets a limit drop below the current usage', async () => {
      files.summarizeCountedLinks.mockResolvedValue(
        new Map([['drop-uuid', { fileCount: 4, totalSize: 800 }]]),
      );

      await expect(
        service.update('drop1234', { maxFiles: 2 }, USER_ID),
      ).resolves.toMatchObject({ state: 'full', fileCount: 4 });
    });

    it('answers a conflict on a taken slug', async () => {
      repository.save.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.update('drop1234', { slug: 'taken' }, USER_ID),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty patch', {}],
      ['null limits', { maxFiles: null }],
      ['out of bounds', { maxTotalBytes: FILES_STORAGE_QUOTA_BYTES + 1 }],
      ['unknown key', { type: 'share' }],
    ])('rejects %s with a 400', async (_case, body) => {
      await expect(
        service.update('drop1234', body, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown drop', async () => {
      repository.findByPublicId.mockResolvedValue(null);

      await expect(
        service.update('unknown1', { disabled: true }, USER_ID),
      ).rejects.toBeInstanceOf(DropNotFoundException);
    });
  });

  describe('lookup', () => {
    it.each(['bad id!', '', 'a'.repeat(200)])(
      'answers 404 for the malformed id %j without a query',
      async (id) => {
        await expect(service.get(id)).rejects.toBeInstanceOf(
          DropNotFoundException,
        );
        await expect(service.remove(id, USER_ID)).rejects.toBeInstanceOf(
          DropNotFoundException,
        );
        expect(repository.findByPublicId).not.toHaveBeenCalled();
      },
    );

    it('answers 404 for an unknown id', async () => {
      await expect(service.get('unknown1')).rejects.toBeInstanceOf(
        DropNotFoundException,
      );
      await expect(service.remove('unknown1', USER_ID)).rejects.toBeInstanceOf(
        DropNotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft deletes the drop and audits it', async () => {
      repository.findByPublicId.mockResolvedValue(buildDrop());

      await service.remove('drop1234', USER_ID);

      expect(repository.softDelete).toHaveBeenCalledWith('drop-uuid');
      expect(audit.record).toHaveBeenCalledWith({
        action: 'drops.deleted',
        userId: USER_ID,
        targetId: 'drop1234',
      });
    });
  });

  describe('mapper', () => {
    it('exposes the public id and nothing internal', () => {
      const response = DropsMapper.toResponse({
        drop: buildDrop({ title: 'Photos' }),
        fileCount: 2,
        totalSize: 30,
        state: 'open',
      });

      expect(response.data).toEqual({
        id: 'drop1234',
        title: 'Photos',
        maxTotalBytes: 1000,
        maxFiles: 5,
        expiresAt: null,
        disabled: false,
        fileCount: 2,
        totalSize: 30,
        state: 'open',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      });
      expect(JSON.stringify(response)).not.toContain('drop-uuid');
    });
  });
});
