import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import type { EventsService } from '../../events/services/events.service.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ShareNotFoundException } from '../../common/exceptions/shares/share-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  LINK_SLUG_MAX_LENGTH,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  PUBLIC_ID_LENGTH,
  SHARE_MAX_DOWNLOADS_LIMIT,
} from '../../common/variables.global.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { EMPTY_LINK_ORGANIZATION } from '../../links/link-organization.js';
import type { LinkOrganizationService } from '../../links/services/link-organization.service.js';

import type {
  NewShare,
  ShareRepository,
} from '../persistence/share.repository.js';
import { SharesService } from './shares.service.js';

const USER_ID = 'user-1';
const FUTURE = '2999-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

function buildShare(overrides: Partial<Link> = {}): Link {
  return {
    id: 'share-uuid',
    publicId: 'share123',
    type: 'share',
    destination: null,
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
    ...overrides,
  };
}

function buildFile(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: 'file-uuid',
    publicId: 'file1234',
    linkId: 'share-uuid',
    s3Key: 'shares/opaque-key',
    name: 'video.mp4',
    size: 150_000_000,
    mime: 'video/mp4',
    sha256: 'a'.repeat(64),
    status: 'ready',
    uploadId: null,
    uploaderName: null,
    uploadTokenHash: null,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    completedAt: new Date('2026-11-01T00:01:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('SharesService', () => {
  let repository: {
    findPage: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let files: {
    listForLink: ReturnType<typeof vi.fn>;
    summarizeLinks: ReturnType<typeof vi.fn>;
  };
  let events: { countViews: ReturnType<typeof vi.fn> };
  let organization: {
    resolve: ReturnType<typeof vi.fn>;
    loadFor: ReturnType<typeof vi.fn>;
    loadOne: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: SharesService;

  beforeEach(() => {
    repository = {
      findPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      findByPublicId: vi.fn().mockResolvedValue(null),
      insert: vi.fn((share: NewShare) =>
        Promise.resolve(buildShare({ ...share })),
      ),
      save: vi.fn((share: Link) => Promise.resolve(share)),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    files = {
      listForLink: vi.fn().mockResolvedValue([]),
      summarizeLinks: vi.fn().mockResolvedValue(new Map()),
    };
    events = { countViews: vi.fn().mockResolvedValue(0) };
    organization = {
      resolve: vi.fn().mockResolvedValue({}),
      loadFor: vi.fn().mockResolvedValue(new Map()),
      loadOne: vi.fn().mockResolvedValue(EMPTY_LINK_ORGANIZATION),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new SharesService(
      repository as unknown as ShareRepository,
      files as unknown as FilesService,
      events as unknown as EventsService,
      audit as unknown as AuditLogService,
      organization as unknown as LinkOrganizationService,
    );
  });

  describe('list', () => {
    it('attaches the file count and total size of each share', async () => {
      const first = buildShare({ id: 'a', publicId: 'first' });
      const second = buildShare({ id: 'b', publicId: 'second' });
      repository.findPage.mockResolvedValue({
        items: [first, second],
        total: 7,
      });
      files.summarizeLinks.mockResolvedValue(
        new Map([
          ['a', { fileCount: 2, totalSize: 300 }],
          ['b', { fileCount: 0, totalSize: 0 }],
        ]),
      );

      const {
        items: summaries,
        total,
        page,
        pageSize,
      } = await service.list({ page: '2', pageSize: '2' });
      expect([total, page, pageSize]).toEqual([7, 2, 2]);

      expect(files.summarizeLinks).toHaveBeenCalledWith(['a', 'b']);
      expect(summaries).toEqual([
        {
          share: first,
          organization: EMPTY_LINK_ORGANIZATION,
          fileCount: 2,
          totalSize: 300,
        },
        {
          share: second,
          organization: EMPTY_LINK_ORGANIZATION,
          fileCount: 0,
          totalSize: 0,
        },
      ]);
    });
  });

  describe('list query', () => {
    it('passes the parsed query and the current date to the repository', async () => {
      await service.list({ q: ' a_b ', state: 'expired', sort: 'slug_asc' });

      expect(repository.findPage).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'a_b',
          state: 'expired',
          sort: 'slug_asc',
          page: 1,
          pageSize: 50,
        }),
        expect.any(Date),
      );
    });

    it('rejects a state that is not a share state', async () => {
      await expect(service.list({ state: 'full' })).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.findPage).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns the share with its files, their total size and its views', async () => {
      const share = buildShare();
      const fileList = [
        buildFile({ size: 150_000_000 }),
        buildFile({ publicId: 'file5678', size: 50, status: 'uploading' }),
      ];
      repository.findByPublicId.mockResolvedValue(share);
      files.listForLink.mockResolvedValue(fileList);
      events.countViews.mockResolvedValue(12);

      const detail = await service.get('share123');

      expect(files.listForLink).toHaveBeenCalledWith('share-uuid');
      expect(events.countViews).toHaveBeenCalledWith('share-uuid');
      expect(detail).toEqual({
        share,
        organization: EMPTY_LINK_ORGANIZATION,
        files: fileList,
        fileCount: 2,
        totalSize: 150_000_050,
        viewCount: 12,
      });
    });

    it('throws ShareNotFoundException for an unknown or deleted share', async () => {
      await expect(service.get('missing')).rejects.toBeInstanceOf(
        ShareNotFoundException,
      );
    });

    it('rejects a malformed id before querying the database', async () => {
      await expect(service.get('bad id!')).rejects.toBeInstanceOf(
        ShareNotFoundException,
      );
      await expect(
        service.get('a'.repeat(LINK_SLUG_MAX_LENGTH + 1)),
      ).rejects.toBeInstanceOf(ShareNotFoundException);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });
  });

  describe('tags and folder', () => {
    it('creates with tags and a folder resolved before the insert and audits public ids', async () => {
      organization.resolve.mockResolvedValue({
        tagIds: ['tag-uuid'],
        folderId: 'folder-uuid',
      });

      await service.create(
        { tagIds: ['tagpub'], folderId: 'folderpub' },
        USER_ID,
      );

      expect(repository.insert).toHaveBeenCalledWith(expect.anything(), {
        tagIds: ['tag-uuid'],
        folderId: 'folder-uuid',
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tagIds: ['tagpub'],
            folderId: 'folderpub',
          }) as unknown,
        }),
      );
    });

    it('audits empty tags and no folder when none is given', async () => {
      await service.create({}, USER_ID);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tagIds: [],
            folderId: null,
          }) as unknown,
        }),
      );
    });

    it('does not insert when a tag is unknown', async () => {
      organization.resolve.mockRejectedValue(new TagNotFoundException());

      await expect(
        service.create({ tagIds: ['tagpub'], folderId: 'folderpub' }, USER_ID),
      ).rejects.toBeInstanceOf(TagNotFoundException);
      expect(repository.insert).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('does not insert when the folder is unknown', async () => {
      organization.resolve.mockRejectedValue(new FolderNotFoundException());

      await expect(
        service.create({ tagIds: ['tagpub'], folderId: 'folderpub' }, USER_ID),
      ).rejects.toBeInstanceOf(FolderNotFoundException);
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('replaces the tags and leaves the folder on update', async () => {
      repository.findByPublicId.mockResolvedValue(buildShare());
      organization.resolve.mockResolvedValue({
        tagIds: ['t1', 't2'],
        folderId: null,
      });

      await service.update(
        'share123',
        { tagIds: ['a', 'b'], folderId: null },
        USER_ID,
      );

      expect(repository.save).toHaveBeenCalledWith(expect.anything(), {
        tagIds: ['t1', 't2'],
        folderId: null,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            changes: { tagIds: ['a', 'b'], folderId: null },
          }) as unknown,
        }),
      );
    });

    it('leaves tags and folder unchanged when absent from the update', async () => {
      repository.findByPublicId.mockResolvedValue(buildShare());

      await service.update('share123', { disabled: true }, USER_ID);

      expect(repository.save).toHaveBeenCalledWith(expect.anything(), {});
    });

    it('does not save when the update names an unknown tag', async () => {
      repository.findByPublicId.mockResolvedValue(buildShare());
      organization.resolve.mockRejectedValue(new TagNotFoundException());

      await expect(
        service.update('share123', { tagIds: ['nope'] }, USER_ID),
      ).rejects.toBeInstanceOf(TagNotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('loads the organization of the whole list in one call', async () => {
      const rows = [
        buildShare({ id: 'a', publicId: 'first' }),
        buildShare({ id: 'b', publicId: 'second' }),
      ];
      repository.findPage.mockResolvedValue({ items: rows, total: 2 });

      await service.list({});

      expect(organization.loadFor).toHaveBeenCalledTimes(1);
      expect(organization.loadFor).toHaveBeenCalledWith(rows);
      expect(organization.loadOne).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a share with a generated public id and audits it', async () => {
      const detail = await service.create({}, USER_ID);

      const [inserted] = repository.insert.mock.calls[0] as [NewShare];
      expect(inserted).toEqual({
        publicId: expect.stringMatching(
          new RegExp(`^[0-9A-Za-z]{${PUBLIC_ID_LENGTH}}$`),
        ) as string,
        expiresAt: null,
        maxDownloads: null,
      });
      expect(detail).toMatchObject({
        files: [],
        fileCount: 0,
        totalSize: 0,
        viewCount: 0,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'shares.created',
          userId: USER_ID,
          targetId: detail.share.publicId,
        }),
      );
    });

    it('uses the chosen slug, expiration and download limit', async () => {
      await service.create(
        { slug: 'my-Share_1', expiresAt: FUTURE, maxDownloads: 3 },
        USER_ID,
      );

      expect(repository.insert).toHaveBeenCalledWith(
        {
          publicId: 'my-Share_1',
          expiresAt: new Date(FUTURE),
          maxDownloads: 3,
        },
        {},
      );
    });

    it('retries when a generated id collides', async () => {
      repository.insert
        .mockRejectedValueOnce(new SlugAlreadyTakenException())
        .mockResolvedValueOnce(buildShare());

      await service.create({}, USER_ID);

      expect(repository.insert).toHaveBeenCalledTimes(2);
    });

    it('gives up after the maximum number of generated id collisions', async () => {
      repository.insert.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(service.create({}, USER_ID)).rejects.toBeInstanceOf(
        SlugAlreadyTakenException,
      );
      expect(repository.insert).toHaveBeenCalledTimes(
        PUBLIC_ID_GENERATION_ATTEMPTS,
      );
    });

    it('lets SlugAlreadyTakenException through for a chosen slug', async () => {
      repository.insert.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.create({ slug: 'taken' }, USER_ID),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(repository.insert).toHaveBeenCalledTimes(1);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it.each([
      ['a reserved slug', { slug: 'api' }],
      ['a slug with forbidden characters', { slug: 'bad slug' }],
      ['a past expiration', { expiresAt: PAST }],
      ['a zero download limit', { maxDownloads: 0 }],
      [
        'a download limit above the maximum',
        { maxDownloads: SHARE_MAX_DOWNLOADS_LIMIT + 1 },
      ],
      ['a fractional download limit', { maxDownloads: 1.5 }],
      ['a destination', { destination: 'https://example.com' }],
      ['a non-object body', 'share'],
    ])('rejects %s with ValidationException', async (_label, body) => {
      await expect(service.create(body, USER_ID)).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(repository.insert).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('applies only the given fields and audits the change', async () => {
      const share = buildShare({
        maxDownloads: 5,
        expiresAt: new Date(FUTURE),
      });
      repository.findByPublicId.mockResolvedValue(share);

      const detail = await service.update(
        'share123',
        { maxDownloads: null, disabled: true },
        USER_ID,
      );

      expect(detail.share).toMatchObject({
        publicId: 'share123',
        maxDownloads: null,
        disabled: true,
        expiresAt: new Date(FUTURE),
      });
      expect(files.listForLink).toHaveBeenCalledWith('share-uuid');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'shares.updated',
          targetId: 'share123',
          metadata: {
            previousId: 'share123',
            changes: { maxDownloads: null, disabled: true },
          },
        }),
      );
    });

    it('renames the slug and clears the expiration', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildShare({ expiresAt: new Date(FUTURE) }),
      );

      const detail = await service.update(
        'share123',
        { slug: 'renamed', expiresAt: null },
        USER_ID,
      );

      expect(detail.share).toMatchObject({
        publicId: 'renamed',
        expiresAt: null,
      });
    });

    it('accepts a download limit already reached', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildShare({ downloadCount: 4 }),
      );

      const detail = await service.update(
        'share123',
        { maxDownloads: 2 },
        USER_ID,
      );

      expect(detail.share.maxDownloads).toBe(2);
    });

    it('rejects an empty change with ValidationException', async () => {
      await expect(
        service.update('share123', {}, USER_ID),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });

    it('throws ShareNotFoundException for an unknown share', async () => {
      await expect(
        service.update('missing', { disabled: true }, USER_ID),
      ).rejects.toBeInstanceOf(ShareNotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('lets SlugAlreadyTakenException through when the new slug is taken', async () => {
      repository.findByPublicId.mockResolvedValue(buildShare());
      repository.save.mockRejectedValue(new SlugAlreadyTakenException());

      await expect(
        service.update('share123', { slug: 'taken' }, USER_ID),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft deletes the share and audits it', async () => {
      repository.findByPublicId.mockResolvedValue(buildShare());

      await service.remove('share123', USER_ID);

      expect(repository.softDelete).toHaveBeenCalledWith('share-uuid');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'shares.deleted',
          targetId: 'share123',
        }),
      );
    });

    it('throws ShareNotFoundException for an unknown share', async () => {
      await expect(service.remove('missing', USER_ID)).rejects.toBeInstanceOf(
        ShareNotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
