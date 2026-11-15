import { QueryFailedError, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { Link } from '../../links/entities/link.entity.js';
import { LinkTag } from '../../tags/entities/link-tag.entity.js';
import { TypeormDropRepository } from './typeorm.drop.repository.js';

function buildQueryBuilder() {
  const qb = {
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.addOrderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

const NOW = new Date('2026-11-15T00:00:00Z');

const NEW_DROP = {
  publicId: 'drop1234',
  title: null,
  expiresAt: null,
  maxFiles: 5,
  maxTotalBytes: 1000,
};

function foreignKeyError(constraint: string): QueryFailedError {
  return new QueryFailedError('INSERT', [], {
    code: 'ER_NO_REFERENCED_ROW_2',
    sqlMessage: `Cannot add or update a child row (CONSTRAINT \`${constraint}\`)`,
  } as unknown as Error);
}

describe('TypeormDropRepository', () => {
  let manager: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
  let orm: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    manager: { transaction: ReturnType<typeof vi.fn> };
  };
  let repository: TypeormDropRepository;

  beforeEach(() => {
    manager = {
      save: vi.fn((_entity: unknown, value: unknown) => Promise.resolve(value)),
      delete: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockResolvedValue(undefined),
    };
    orm = {
      createQueryBuilder: vi.fn(),
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((value: unknown) => value),
      softDelete: vi.fn().mockResolvedValue(undefined),
      manager: {
        transaction: vi.fn((run: (m: unknown) => Promise<unknown>) =>
          run(manager),
        ),
      },
    };
    repository = new TypeormDropRepository(orm as unknown as Repository<Link>);
  });

  it('lists a page of drops only, through the shared list query', async () => {
    const qb = buildQueryBuilder();
    orm.createQueryBuilder.mockReturnValue(qb);
    const query = {
      sort: 'created_desc',
      page: 2,
      pageSize: 10,
      state: 'full',
    };

    const result = await repository.findPage(query as never, NOW);

    expect(orm.createQueryBuilder).toHaveBeenCalledWith('link');
    expect(qb.where).toHaveBeenCalledWith('link.type = :type', {
      type: 'drop',
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('finds by public id within drops', async () => {
    await repository.findByPublicId('drop1234');

    expect(orm.findOneBy).toHaveBeenCalledWith({
      publicId: 'drop1234',
      type: 'drop',
    });
  });

  it('inserts a drop without destination, in a transaction', async () => {
    await repository.insert(NEW_DROP, {});

    expect(orm.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(Link, {
      ...NEW_DROP,
      type: 'drop',
      destination: null,
    });
  });

  it('writes the folder and replaces the tags', async () => {
    await repository.insert(NEW_DROP, {
      tagIds: ['t1', 't2'],
      folderId: 'folder-uuid',
    });

    expect(manager.save).toHaveBeenCalledWith(
      Link,
      expect.objectContaining({ folderId: 'folder-uuid' }),
    );
    expect(manager.delete).toHaveBeenCalledWith(LinkTag, expect.anything());
    expect(manager.insert).toHaveBeenCalledWith(LinkTag, [
      expect.objectContaining({ tagId: 't1' }),
      expect.objectContaining({ tagId: 't2' }),
    ]);
    expect(manager.delete.mock.invocationCallOrder[0]).toBeLessThan(
      manager.insert.mock.invocationCallOrder[0],
    );
  });

  it('removes every tag and leaves the folder alone for an empty list', async () => {
    const drop = { id: 'drop-uuid', folderId: 'kept' } as Link;

    await repository.save(drop, { tagIds: [] });

    expect(manager.delete).toHaveBeenCalledWith(LinkTag, {
      linkId: 'drop-uuid',
    });
    expect(manager.insert).not.toHaveBeenCalled();
    expect(drop.folderId).toBe('kept');
  });

  it('takes the folder out with null and keeps the tags when absent', async () => {
    const drop = { id: 'drop-uuid', folderId: 'old' } as Link;

    await repository.save(drop, { folderId: null });

    expect(drop.folderId).toBeNull();
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('soft deletes within drops', async () => {
    await repository.softDelete('drop-uuid');

    expect(orm.softDelete).toHaveBeenCalledWith({
      id: 'drop-uuid',
      type: 'drop',
    });
  });

  it.each([
    ['insert', () => repository.insert(NEW_DROP, {})],
    ['save', () => repository.save({} as Link, {})],
  ])('turns a duplicate slug into a conflict on %s', async (_name, run) => {
    manager.save.mockRejectedValue(
      new QueryFailedError('INSERT', [], {
        code: 'ER_DUP_ENTRY',
      } as unknown as Error),
    );

    await expect(run()).rejects.toBeInstanceOf(SlugAlreadyTakenException);
  });

  it('turns an unknown tag into TagNotFoundException out of the transaction', async () => {
    manager.insert.mockRejectedValue(foreignKeyError('FK_link_tags_tag'));

    await expect(
      repository.insert(NEW_DROP, { tagIds: ['gone'] }),
    ).rejects.toBeInstanceOf(TagNotFoundException);
  });

  it('turns an unknown folder into FolderNotFoundException out of the transaction', async () => {
    manager.save.mockRejectedValue(foreignKeyError('FK_links_folder'));

    await expect(
      repository.insert(NEW_DROP, { folderId: 'gone' }),
    ).rejects.toBeInstanceOf(FolderNotFoundException);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('lets other errors through', async () => {
    const failure = new Error('connection lost');
    manager.save.mockRejectedValue(failure);

    await expect(repository.insert(NEW_DROP, {})).rejects.toBe(failure);
  });
});
