import { IsNull, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
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

  describe('insertWithinLimits', () => {
    const limits = { maxFiles: 2, quotaBytes: 1000 };
    const file = {
      publicId: 'file1234',
      linkId: 'link-uuid',
      s3Key: 'files/opaque',
      name: 'a.bin',
      size: 100,
      sha256: 'a'.repeat(64),
      uploadId: 'upload-1',
    };
    let files: {
      countBy: ReturnType<typeof vi.fn>;
      sum: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
    };
    let lock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      files = {
        countBy: vi.fn().mockResolvedValue(0),
        sum: vi.fn().mockResolvedValue(null),
        create: vi.fn((value: unknown) => value),
        save: vi.fn((value: unknown) => Promise.resolve(value)),
      };
      lock = vi.fn();
      const linkQuery = {
        setLock: lock,
        where: vi.fn(),
        getOne: vi.fn().mockResolvedValue({}),
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
        repository.insertWithinLimits(file, limits),
      ).resolves.toMatchObject({ ...file, status: 'uploading', mime: null });
      expect(lock).toHaveBeenCalledWith('pessimistic_write');
    });

    it('refuses a file when the share already holds the maximum', async () => {
      files.countBy.mockResolvedValue(2);

      await expect(
        repository.insertWithinLimits(file, limits),
      ).rejects.toBeInstanceOf(TooManyFilesException);
      expect(files.save).not.toHaveBeenCalled();
    });

    it('refuses a file that would go over the quota counted in SQL', async () => {
      files.sum.mockResolvedValue('901');

      await expect(
        repository.insertWithinLimits(file, limits),
      ).rejects.toBeInstanceOf(StorageQuotaExceededException);
      expect(files.save).not.toHaveBeenCalled();
    });

    it('counts only files that are neither rejected nor deleted', async () => {
      await repository.insertWithinLimits(file, limits);

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
});
