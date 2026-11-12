import { IsNull, QueryFailedError, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkBytesLimitExceededException } from '../../common/exceptions/files/link-bytes-limit-exceeded.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotReadyException } from '../../common/exceptions/files/file-not-ready.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type { UploadLimits } from './stored-file.repository.js';
import { TypeormStoredFileRepository } from './typeorm.stored-file.repository.js';

function queryBuilder(rows: unknown[]) {
  const builder = {
    select: vi.fn(),
    addSelect: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    groupBy: vi.fn(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };
  for (const method of Object.keys(builder)) {
    if (method !== 'getRawMany') {
      builder[method as keyof typeof builder].mockReturnValue(builder);
    }
  }
  return builder;
}

describe('TypeormStoredFileRepository', () => {
  let ormRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormStoredFileRepository;

  beforeEach(() => {
    ormRepository = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      createQueryBuilder: vi.fn(),
    };
    repository = new TypeormStoredFileRepository(
      ormRepository as unknown as Repository<StoredFile>,
    );
  });

  it('finds a file by id including soft-deleted rows', async () => {
    await repository.findByIdWithDeleted('file-uuid');

    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'file-uuid' },
      withDeleted: true,
    });
  });

  it('skips the query when no link is requested', async () => {
    await expect(repository.summarizeByLinkIds([])).resolves.toEqual([]);
    expect(ormRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('sums the non-deleted files per link and converts MySQL strings to numbers', async () => {
    const builder = queryBuilder([
      { linkId: 'a', fileCount: '2', totalSize: '9007199254740' },
    ]);
    ormRepository.createQueryBuilder.mockReturnValue(builder);

    const summaries = await repository.summarizeByLinkIds(['a']);

    expect(builder.where).toHaveBeenCalledWith('file.linkId IN (:...linkIds)', {
      linkIds: ['a'],
    });
    expect(builder.andWhere).toHaveBeenCalledWith('file.deletedAt IS NULL');
    expect(summaries).toEqual([
      { linkId: 'a', fileCount: 2, totalSize: 9_007_199_254_740 },
    ]);
  });

  describe('summarizeCountedByLinkIds', () => {
    it('skips the query when no link is requested', async () => {
      await expect(repository.summarizeCountedByLinkIds([])).resolves.toEqual(
        [],
      );
      expect(ormRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('leaves rejected and deleted files out', async () => {
      const builder = queryBuilder([
        { linkId: 'a', fileCount: '1', totalSize: '40' },
      ]);
      ormRepository.createQueryBuilder.mockReturnValue(builder);

      const summaries = await repository.summarizeCountedByLinkIds(['a']);

      expect(builder.andWhere).toHaveBeenCalledWith('file.deletedAt IS NULL');
      expect(builder.andWhere).toHaveBeenCalledWith(
        'file.status <> :rejected',
        { rejected: 'rejected' },
      );
      expect(summaries).toEqual([{ linkId: 'a', fileCount: 1, totalSize: 40 }]);
    });
  });

  describe('insertWithinLimits', () => {
    const limits = { maxFiles: 2, maxLinkBytes: null, quotaBytes: 1000 };
    const limitsFor = vi.fn<(link: unknown) => UploadLimits>(() => limits);
    const file = {
      publicId: 'file1234',
      linkId: 'link-uuid',
      s3Key: 'files/opaque',
      name: 'a.bin',
      size: 100,
      sha256: 'a'.repeat(64),
      uploadId: 'upload-1',
      uploaderName: null,
      uploadTokenHash: null,
    };
    let files: {
      countBy: ReturnType<typeof vi.fn>;
      sum: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
    };
    let lock: ReturnType<typeof vi.fn>;
    const lockedLink = { id: 'link-uuid', type: 'drop' };

    beforeEach(() => {
      files = {
        countBy: vi.fn().mockResolvedValue(0),
        sum: vi.fn().mockResolvedValue(null),
        create: vi.fn((value: unknown) => value),
        save: vi.fn((value: unknown) => Promise.resolve(value)),
      };
      lock = vi.fn();
      limitsFor.mockClear();
      limitsFor.mockReturnValue(limits);
      const linkQuery = {
        setLock: lock,
        where: vi.fn(),
        getOne: vi.fn().mockResolvedValue(lockedLink),
      };
      lock.mockReturnValue(linkQuery);
      linkQuery.where.mockReturnValue(linkQuery);
      const manager = {
        getRepository: (entity: { name: string }) =>
          entity.name === 'Link'
            ? { createQueryBuilder: () => linkQuery }
            : files,
      };
      Object.assign(ormRepository, {
        manager: {
          transaction: (work: (m: typeof manager) => Promise<unknown>) =>
            work(manager),
        },
      });
    });

    it('locks the link, then inserts an uploading file within the limits', async () => {
      files.sum.mockResolvedValue('800');

      await expect(
        repository.insertWithinLimits(file, limitsFor),
      ).resolves.toMatchObject({ ...file, status: 'uploading', mime: null });
      expect(lock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('refuses a file when the share already holds the maximum', async () => {
      files.countBy.mockResolvedValue(2);

      await expect(
        repository.insertWithinLimits(file, limitsFor),
      ).rejects.toBeInstanceOf(TooManyFilesException);
      expect(files.save).not.toHaveBeenCalled();
    });

    it('refuses a file that would go over the quota counted in SQL', async () => {
      files.sum.mockResolvedValue('901');

      await expect(
        repository.insertWithinLimits(file, limitsFor),
      ).rejects.toBeInstanceOf(StorageQuotaExceededException);
      expect(files.save).not.toHaveBeenCalled();
    });

    it('reads the limits from the locked link, before counting anything', async () => {
      await repository.insertWithinLimits(file, limitsFor);

      expect(limitsFor).toHaveBeenCalledWith(lockedLink);
      expect(limitsFor.mock.invocationCallOrder[0]).toBeLessThan(
        files.countBy.mock.invocationCallOrder[0],
      );
      expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
        limitsFor.mock.invocationCallOrder[0],
      );
    });

    it('stops when the limits callback refuses the locked link', async () => {
      limitsFor.mockImplementation(() => {
        throw new Error('closed');
      });

      await expect(
        repository.insertWithinLimits(file, limitsFor),
      ).rejects.toThrow('closed');
      expect(files.countBy).not.toHaveBeenCalled();
      expect(files.save).not.toHaveBeenCalled();
    });

    it('skips the per-link byte sum when there is no per-link limit', async () => {
      await repository.insertWithinLimits(file, limitsFor);

      expect(files.sum).toHaveBeenCalledTimes(1);
    });

    it('refuses a file that would exceed the per-link byte limit', async () => {
      limitsFor.mockReturnValue({ ...limits, maxLinkBytes: 500 });
      files.sum.mockResolvedValueOnce('401');

      await expect(
        repository.insertWithinLimits(file, limitsFor),
      ).rejects.toBeInstanceOf(LinkBytesLimitExceededException);
      expect(files.save).not.toHaveBeenCalled();
    });

    it('counts the per-link bytes of this link only, before the global quota', async () => {
      limitsFor.mockReturnValue({ ...limits, maxLinkBytes: 500 });
      files.sum.mockResolvedValueOnce('400');

      await repository.insertWithinLimits(file, limitsFor);

      expect(files.sum.mock.calls[0][1]).toMatchObject({ linkId: 'link-uuid' });
      expect(files.sum.mock.calls[1][1]).not.toHaveProperty('linkId');
    });

    it('counts only files that are neither rejected nor deleted', async () => {
      await repository.insertWithinLimits(file, limitsFor);

      const [where] = files.sum.mock.calls[0].slice(1) as [
        Record<string, unknown>,
      ];
      expect(Object.keys(where).sort()).toEqual(['deletedAt', 'status']);
    });
  });

  it('only moves a file that is still in the expected status', async () => {
    Object.assign(ormRepository, {
      update: vi.fn().mockResolvedValue({ affected: 0 }),
    });

    await expect(
      repository.transition('file-uuid', 'uploading', { status: 'verifying' }),
    ).resolves.toBe(false);
  });

  it('never moves a soft-deleted file', async () => {
    const update = vi.fn().mockResolvedValue({ affected: 1 });
    Object.assign(ormRepository, { update });

    await expect(
      repository.transition('file-uuid', 'uploading', { status: 'verifying' }),
    ).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith(
      { id: 'file-uuid', status: 'uploading', deletedAt: IsNull() },
      { status: 'verifying' },
    );
  });

  describe('with link', () => {
    function linkQuery(result: unknown) {
      const builder = {
        withDeleted: vi.fn(),
        innerJoinAndSelect: vi.fn(),
        where: vi.fn(),
        andWhere: vi.fn(),
        orderBy: vi.fn(),
        addOrderBy: vi.fn(),
        getMany: vi.fn().mockResolvedValue(result),
        getOne: vi.fn().mockResolvedValue(result),
      };
      for (const method of Object.keys(builder)) {
        if (!method.startsWith('get')) {
          builder[method as keyof typeof builder].mockReturnValue(builder);
        }
      }
      return builder;
    }

    it('loads deleted links but not deleted files, newest first', async () => {
      const builder = linkQuery([{ publicId: 'a' }]);
      ormRepository.createQueryBuilder.mockReturnValue(builder);

      await expect(repository.findAllWithLink()).resolves.toEqual([
        { publicId: 'a' },
      ]);

      expect(builder.withDeleted).toHaveBeenCalled();
      expect(builder.innerJoinAndSelect).toHaveBeenCalledWith(
        'file.link',
        'link',
      );
      expect(builder.withDeleted.mock.invocationCallOrder[0]).toBeLessThan(
        builder.innerJoinAndSelect.mock.invocationCallOrder[0],
      );
      expect(builder.where).toHaveBeenCalledWith('file.deletedAt IS NULL');
      expect(builder.orderBy).toHaveBeenCalledWith('file.createdAt', 'DESC');
      expect(builder.addOrderBy).toHaveBeenCalledWith('file.publicId', 'ASC');
    });

    it('finds one non-deleted file by public id with its link', async () => {
      const builder = linkQuery({ publicId: 'file1234' });
      ormRepository.createQueryBuilder.mockReturnValue(builder);

      await expect(
        repository.findByPublicIdWithLink('file1234'),
      ).resolves.toEqual({ publicId: 'file1234' });

      expect(builder.withDeleted).toHaveBeenCalled();
      expect(builder.where).toHaveBeenCalledWith('file.deletedAt IS NULL');
      expect(builder.andWhere).toHaveBeenCalledWith(
        'file.publicId = :publicId',
        { publicId: 'file1234' },
      );
    });
  });

  it('sums the bytes counted in the quota with the same rule as the insert', async () => {
    const sum = vi.fn().mockResolvedValue('1234');
    Object.assign(ormRepository, { sum });

    await expect(repository.sumCountedBytes()).resolves.toBe(1234);

    const [column, where] = sum.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(column).toBe('size');
    expect(Object.keys(where).sort()).toEqual(['deletedAt', 'status']);
  });

  it('lists the files of a link oldest first', async () => {
    await repository.findByLinkId('a');

    expect(ormRepository.find).toHaveBeenCalledWith({
      where: { linkId: 'a' },
      order: { createdAt: 'ASC' },
    });
  });

  describe('moveToNewShare', () => {
    const share = { publicId: 'share123', expiresAt: null, maxDownloads: 3 };
    const ids = ['f1', 'f2'];
    let links: {
      create: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    let files: {
      find: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    let lockedDrop: unknown;

    function storedFile(publicId: string, status = 'ready') {
      return { id: `${publicId}-uuid`, publicId, status, linkId: 'drop-uuid' };
    }

    beforeEach(() => {
      lockedDrop = { id: 'drop-uuid', type: 'drop', deletedAt: null };
      links = {
        create: vi.fn((value: unknown) => value),
        save: vi.fn((value: object) =>
          Promise.resolve({ ...value, id: 'share-uuid' }),
        ),
        update: vi.fn().mockResolvedValue(undefined),
      };
      files = {
        find: vi.fn().mockResolvedValue([storedFile('f1'), storedFile('f2')]),
        update: vi.fn().mockResolvedValue(undefined),
      };
      const query = {
        setLock: vi.fn(),
        where: vi.fn(),
        getOne: vi.fn(() => Promise.resolve(lockedDrop)),
      };
      query.setLock.mockReturnValue(query);
      query.where.mockReturnValue(query);
      const manager = {
        getRepository: (entity: { name: string }) =>
          entity.name === 'Link'
            ? { ...links, createQueryBuilder: () => query }
            : files,
      };
      Object.assign(ormRepository, {
        manager: {
          transaction: (work: (m: typeof manager) => Promise<unknown>) =>
            work(manager),
        },
      });
    });

    it('creates the share, moves the files and closes the drop', async () => {
      const result = await repository.moveToNewShare(
        'drop-uuid',
        ids,
        share,
        true,
      );

      expect(links.save).toHaveBeenCalledWith(
        expect.objectContaining({ ...share, type: 'share', destination: null }),
      );
      expect(files.update).toHaveBeenCalledWith(
        { id: expect.anything() as unknown },
        { linkId: 'share-uuid', uploadTokenHash: null },
      );
      expect(links.update).toHaveBeenCalledWith(
        { id: 'drop-uuid' },
        { disabled: true },
      );
      expect(result.share).toMatchObject({ id: 'share-uuid' });
      expect(result.files.map((file) => file.linkId)).toEqual([
        'share-uuid',
        'share-uuid',
      ]);
    });

    it('keeps the drop open when closeDrop is false', async () => {
      await repository.moveToNewShare('drop-uuid', ids, share, false);

      expect(files.update).toHaveBeenCalled();
      expect(links.update).not.toHaveBeenCalled();
    });

    it.each([
      ['missing', null],
      ['not a drop', { id: 'drop-uuid', type: 'share', deletedAt: null }],
      ['deleted', { id: 'drop-uuid', type: 'drop', deletedAt: new Date() }],
    ])('answers a drop not found when the drop is %s', async (_, found) => {
      lockedDrop = found;

      await expect(
        repository.moveToNewShare('drop-uuid', ids, share, true),
      ).rejects.toBeInstanceOf(DropNotFoundException);
      expect(links.save).not.toHaveBeenCalled();
      expect(files.update).not.toHaveBeenCalled();
      expect(links.update).not.toHaveBeenCalled();
    });

    it('refuses when a file is unknown, from another link or deleted', async () => {
      files.find.mockResolvedValue([storedFile('f1')]);

      await expect(
        repository.moveToNewShare('drop-uuid', ids, share, true),
      ).rejects.toBeInstanceOf(FileNotFoundException);
      expect(links.save).not.toHaveBeenCalled();
      expect(files.update).not.toHaveBeenCalled();
      expect(links.update).not.toHaveBeenCalled();
    });

    it('refuses a file that is not ready', async () => {
      files.find.mockResolvedValue([
        storedFile('f1'),
        storedFile('f2', 'verifying'),
      ]);

      await expect(
        repository.moveToNewShare('drop-uuid', ids, share, true),
      ).rejects.toBeInstanceOf(FileNotReadyException);
      expect(links.save).not.toHaveBeenCalled();
      expect(files.update).not.toHaveBeenCalled();
    });

    it('translates a duplicate slug and moves nothing', async () => {
      links.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], { code: 'ER_DUP_ENTRY' } as never),
      );

      await expect(
        repository.moveToNewShare('drop-uuid', ids, share, true),
      ).rejects.toBeInstanceOf(SlugAlreadyTakenException);
      expect(files.update).not.toHaveBeenCalled();
      expect(links.update).not.toHaveBeenCalled();
    });

    it('lets the transaction fail, and so roll back, when a step breaks midway', async () => {
      const failure = new Error('deadlock');
      files.update.mockRejectedValue(failure);

      await expect(
        repository.moveToNewShare('drop-uuid', ids, share, true),
      ).rejects.toBe(failure);
      expect(links.update).not.toHaveBeenCalled();
    });
  });
});
