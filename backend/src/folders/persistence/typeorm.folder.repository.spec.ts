import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderNameAlreadyTakenException } from '../../common/exceptions/folders/folder-name-already-taken.exception.js';
import { FolderPublicIdTakenException } from '../../common/exceptions/folders/folder-public-id-taken.exception.js';
import type { Folder } from '../entities/folder.entity.js';
import { TypeormFolderRepository } from './typeorm.folder.repository.js';

const NEW_FOLDER = {
  publicId: 'abc123',
  name: 'Work',
  nameKey: 'work',
};

function duplicate(index: string): QueryFailedError {
  return new QueryFailedError('INSERT', [], {
    code: 'ER_DUP_ENTRY',
    sqlMessage: `Duplicate entry 'x' for key 'folders.${index}'`,
  } as unknown as Error);
}

describe('TypeormFolderRepository', () => {
  let typeorm: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormFolderRepository;

  beforeEach(() => {
    typeorm = {
      create: vi.fn((folder: unknown) => folder),
      save: vi.fn((folder: unknown) => Promise.resolve(folder)),
      findOneBy: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(),
    };
    repository = new TypeormFolderRepository(
      typeorm as unknown as Repository<Folder>,
    );
  });

  describe('insert', () => {
    it('throws FolderNameAlreadyTakenException on a name key duplicate', async () => {
      typeorm.save.mockRejectedValue(duplicate('UQ_folders_name_key'));

      await expect(repository.insert(NEW_FOLDER)).rejects.toBeInstanceOf(
        FolderNameAlreadyTakenException,
      );
    });

    it('throws FolderPublicIdTakenException on a public id duplicate', async () => {
      typeorm.save.mockRejectedValue(duplicate('UQ_folders_public_id'));

      await expect(repository.insert(NEW_FOLDER)).rejects.toBeInstanceOf(
        FolderPublicIdTakenException,
      );
    });

    it('rethrows any other error', async () => {
      const failure = new Error('connection lost');
      typeorm.save.mockRejectedValue(failure);

      await expect(repository.insert(NEW_FOLDER)).rejects.toBe(failure);
    });
  });

  it('looks folders up by name key', async () => {
    await repository.findByNameKey('work');

    expect(typeorm.findOneBy).toHaveBeenCalledWith({ nameKey: 'work' });
  });

  it('deletes a folder by its internal id', async () => {
    await repository.remove({ id: 'f1' } as Folder);

    expect(typeorm.delete).toHaveBeenCalledWith({ id: 'f1' });
  });

  describe('link counts', () => {
    function queryBuilder(result: Record<string, unknown>) {
      const builder: Record<string, unknown> = {};
      for (const method of [
        'leftJoin',
        'addSelect',
        'select',
        'where',
        'groupBy',
        'orderBy',
      ]) {
        builder[method] = vi.fn().mockReturnValue(builder);
      }
      builder.getRawAndEntities = vi.fn().mockResolvedValue(result);
      builder.getRawOne = vi.fn().mockResolvedValue(result);
      return builder;
    }

    it('converts the aggregated linkCount to a number in the list', async () => {
      const folder = { id: 't1' } as Folder;
      typeorm.createQueryBuilder.mockReturnValue(
        queryBuilder({ entities: [folder], raw: [{ linkCount: '4' }] }),
      );

      await expect(repository.listWithLinkCounts()).resolves.toEqual([
        { folder, linkCount: 4 },
      ]);
    });

    it('converts the aggregated linkCount to a number for one folder', async () => {
      typeorm.createQueryBuilder.mockReturnValue(
        queryBuilder({ linkCount: '2' }),
      );

      await expect(repository.countLinks('t1')).resolves.toBe(2);
    });
  });
});
