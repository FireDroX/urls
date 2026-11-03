import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormStoredFileRepository;

  beforeEach(() => {
    ormRepository = {
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(),
    };
    repository = new TypeormStoredFileRepository(
      ormRepository as unknown as Repository<StoredFile>,
    );
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

  it('lists the files of a link oldest first', async () => {
    await repository.findByLinkId('a');

    expect(ormRepository.find).toHaveBeenCalledWith({
      where: { linkId: 'a' },
      order: { createdAt: 'ASC' },
    });
  });
});
