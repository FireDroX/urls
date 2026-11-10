import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileInUseException } from '../../common/exceptions/files/file-in-use.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotReadyException } from '../../common/exceptions/files/file-not-ready.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  FILE_DOWNLOAD_URL_TTL_SECONDS,
  FILES_STORAGE_QUOTA_BYTES,
} from '../../common/variables.global.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';
import type { FileDeletionService } from './file-deletion.service.js';
import { FilesAdminService } from './files-admin.service.js';

const USER_ID = 'user-1';

function buildLink(overrides: Partial<Link> = {}): Link {
  return {
    type: 'share',
    publicId: 'share123',
    disabled: false,
    expiresAt: null,
    maxDownloads: null,
    downloadCount: 0,
    deletedAt: null,
    ...overrides,
  } as Link;
}

function buildFile(
  publicId: string,
  link: Link,
  overrides: Partial<StoredFile> = {},
): StoredFile {
  return {
    id: `${publicId}-uuid`,
    publicId,
    s3Key: `files/${publicId}`,
    name: `${publicId}.bin`,
    size: 100,
    mime: null,
    status: 'ready',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    completedAt: null,
    link,
    ...overrides,
  } as StoredFile;
}

describe('FilesAdminService', () => {
  let repository: {
    findAllWithLink: ReturnType<typeof vi.fn>;
    findByPublicIdWithLink: ReturnType<typeof vi.fn>;
    sumCountedBytes: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    transition: ReturnType<typeof vi.fn>;
  };
  let storage: {
    getUsage: ReturnType<typeof vi.fn>;
    getPresignedDownloadUrl: ReturnType<typeof vi.fn>;
  };
  let deletion: { erase: ReturnType<typeof vi.fn> };
  let service: FilesAdminService;

  beforeEach(() => {
    repository = {
      findAllWithLink: vi.fn().mockResolvedValue([]),
      findByPublicIdWithLink: vi.fn().mockResolvedValue(null),
      sumCountedBytes: vi.fn().mockResolvedValue(0),
      softDelete: vi.fn(),
      transition: vi.fn(),
    };
    storage = {
      getUsage: vi.fn().mockResolvedValue({ usedBytes: 5, quotaBytes: 10 }),
      getPresignedDownloadUrl: vi.fn().mockResolvedValue('https://signed'),
    };
    deletion = { erase: vi.fn().mockResolvedValue(undefined) };
    service = new FilesAdminService(
      repository as unknown as StoredFileRepository,
      storage as unknown as StorageService,
      deletion as unknown as FileDeletionService,
    );
  });

  describe('list', () => {
    const past = new Date('2020-01-01T00:00:00Z');

    beforeEach(() => {
      repository.findAllWithLink.mockResolvedValue([
        buildFile('active', buildLink()),
        buildFile('disabled', buildLink({ disabled: true })),
        buildFile('expired', buildLink({ expiresAt: past })),
        buildFile('deleted', buildLink({ deletedAt: new Date() })),
        buildFile('dropped', buildLink({ type: 'drop' }), { size: 50 }),
        buildFile('rejected', buildLink({ deletedAt: new Date() }), {
          status: 'rejected',
          size: 7,
        }),
      ]);
    });

    it('flags files in use for every link state', async () => {
      const { files } = await service.list({});

      const byId = Object.fromEntries(
        files.map((entry) => [entry.file.publicId, entry]),
      );
      expect(
        Object.fromEntries(
          Object.entries(byId).map(([id, entry]) => [id, entry.inUse]),
        ),
      ).toEqual({
        active: true,
        disabled: true,
        expired: true,
        deleted: false,
        dropped: false,
        rejected: false,
      });
      expect(byId.expired.expired).toBe(true);
      expect(byId.active.expired).toBe(false);
    });

    it('keeps only orphans with orphans=true and leaves the summary unchanged', async () => {
      const all = await service.list({});
      const orphans = await service.list({ orphans: 'true' });

      expect(orphans.files.map(({ file }) => file.publicId)).toEqual([
        'deleted',
        'dropped',
        'rejected',
      ]);
      expect(orphans.summary).toEqual(all.summary);
    });

    it('builds the summary, ignoring rejected orphans in orphanBytes', async () => {
      repository.sumCountedBytes.mockResolvedValue(450);

      const { summary } = await service.list({});

      expect(summary).toEqual({
        quotaUsedBytes: 450,
        quotaLimitBytes: FILES_STORAGE_QUOTA_BYTES,
        orphanBytes: 150,
        storageUsedBytes: 5,
      });
    });

    it('answers with a null storage usage when RustFS is unreachable', async () => {
      storage.getUsage.mockRejectedValue(new StorageUnavailableException());

      const { files, summary } = await service.list({});

      expect(summary.storageUsedBytes).toBeNull();
      expect(files).toHaveLength(6);
    });

    it('keeps a null usage from the storage as null', async () => {
      storage.getUsage.mockResolvedValue({ usedBytes: null, quotaBytes: null });

      expect((await service.list({})).summary.storageUsedBytes).toBeNull();
    });

    it('rethrows other storage errors', async () => {
      storage.getUsage.mockRejectedValue(new Error('boom'));

      await expect(service.list({})).rejects.toThrow('boom');
    });

    it.each([{ orphans: 'false' }, { orphans: '' }, { other: '1' }])(
      'rejects the query %j with a validation error',
      async (query) => {
        await expect(service.list(query)).rejects.toBeInstanceOf(
          ValidationException,
        );
        expect(repository.findAllWithLink).not.toHaveBeenCalled();
      },
    );
  });

  describe('remove', () => {
    it.each(['bad id!', 'x'.repeat(100)])(
      'answers 404 for the malformed id %s without querying',
      async (id) => {
        await expect(service.remove(id, USER_ID)).rejects.toBeInstanceOf(
          FileNotFoundException,
        );
        expect(repository.findByPublicIdWithLink).not.toHaveBeenCalled();
      },
    );

    it('answers 404 for an unknown or already deleted file', async () => {
      await expect(service.remove('file1234', USER_ID)).rejects.toBeInstanceOf(
        FileNotFoundException,
      );
      expect(deletion.erase).not.toHaveBeenCalled();
    });

    it.each([
      ['active', buildLink()],
      ['disabled', buildLink({ disabled: true })],
      ['expired', buildLink({ expiresAt: new Date('2020-01-01') })],
    ])('answers 409 for a file of a %s share', async (_label, link) => {
      repository.findByPublicIdWithLink.mockResolvedValue(
        buildFile('file1234', link),
      );

      await expect(service.remove('file1234', USER_ID)).rejects.toBeInstanceOf(
        FileInUseException,
      );
      expect(deletion.erase).not.toHaveBeenCalled();
    });

    it.each([
      ['deleted share', buildLink({ deletedAt: new Date() })],
      ['drop link', buildLink({ type: 'drop' })],
    ])('erases an orphan of a %s', async (_label, link) => {
      const file = buildFile('file1234', link);
      repository.findByPublicIdWithLink.mockResolvedValue(file);

      await service.remove('file1234', USER_ID);

      expect(deletion.erase).toHaveBeenCalledWith(file, link, {
        action: 'files.deleted',
        userId: USER_ID,
      });
    });

    it('propagates a storage failure', async () => {
      repository.findByPublicIdWithLink.mockResolvedValue(
        buildFile('file1234', buildLink({ type: 'drop' })),
      );
      deletion.erase.mockRejectedValue(new StorageUnavailableException());

      await expect(service.remove('file1234', USER_ID)).rejects.toBeInstanceOf(
        StorageUnavailableException,
      );
    });
  });

  describe('createDownloadUrl', () => {
    it('signs a short download URL for a ready file', async () => {
      repository.findByPublicIdWithLink.mockResolvedValue(
        buildFile('file1234', buildLink()),
      );

      await expect(service.createDownloadUrl('file1234')).resolves.toBe(
        'https://signed',
      );
      expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
        'files/file1234',
        'file1234.bin',
        FILE_DOWNLOAD_URL_TTL_SECONDS,
      );
    });

    it.each(['uploading', 'verifying', 'rejected'] as const)(
      'answers 409 for a %s file',
      async (status) => {
        repository.findByPublicIdWithLink.mockResolvedValue(
          buildFile('file1234', buildLink(), { status }),
        );

        await expect(
          service.createDownloadUrl('file1234'),
        ).rejects.toBeInstanceOf(FileNotReadyException);
        expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled();
      },
    );

    it('answers 404 for a malformed or unknown id', async () => {
      await expect(service.createDownloadUrl('bad id!')).rejects.toBeInstanceOf(
        FileNotFoundException,
      );
      await expect(
        service.createDownloadUrl('file1234'),
      ).rejects.toBeInstanceOf(FileNotFoundException);
    });

    it('writes nothing', async () => {
      repository.findByPublicIdWithLink.mockResolvedValue(
        buildFile('file1234', buildLink()),
      );

      await service.createDownloadUrl('file1234');

      expect(repository.softDelete).not.toHaveBeenCalled();
      expect(repository.transition).not.toHaveBeenCalled();
      expect(deletion.erase).not.toHaveBeenCalled();
    });
  });
});
