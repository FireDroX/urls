import { QueryFailedError, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import type { Link } from '../../links/entities/link.entity.js';
import { TypeormDropRepository } from './typeorm.drop.repository.js';

const NEW_DROP = {
  publicId: 'drop1234',
  title: null,
  expiresAt: null,
  maxFiles: 5,
  maxTotalBytes: 1000,
};

describe('TypeormDropRepository', () => {
  let orm: {
    find: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormDropRepository;

  beforeEach(() => {
    orm = {
      find: vi.fn().mockResolvedValue([]),
      findOneBy: vi.fn().mockResolvedValue(null),
      create: vi.fn((value: unknown) => value),
      save: vi.fn((value: unknown) => Promise.resolve(value)),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    repository = new TypeormDropRepository(orm as unknown as Repository<Link>);
  });

  it('lists drops only, newest first', async () => {
    await repository.findAll();

    expect(orm.find).toHaveBeenCalledWith({
      where: { type: 'drop' },
      order: { createdAt: 'DESC' },
    });
  });

  it('finds by public id within drops', async () => {
    await repository.findByPublicId('drop1234');

    expect(orm.findOneBy).toHaveBeenCalledWith({
      publicId: 'drop1234',
      type: 'drop',
    });
  });

  it('inserts a drop without destination', async () => {
    await repository.insert(NEW_DROP);

    expect(orm.save).toHaveBeenCalledWith({
      ...NEW_DROP,
      type: 'drop',
      destination: null,
    });
  });

  it('soft deletes within drops', async () => {
    await repository.softDelete('drop-uuid');

    expect(orm.softDelete).toHaveBeenCalledWith({
      id: 'drop-uuid',
      type: 'drop',
    });
  });

  it.each([
    ['insert', () => repository.insert(NEW_DROP)],
    ['save', () => repository.save({} as Link)],
  ])('turns a duplicate slug into a conflict on %s', async (_name, run) => {
    orm.save.mockRejectedValue(
      new QueryFailedError('INSERT', [], {
        code: 'ER_DUP_ENTRY',
      } as unknown as Error),
    );

    await expect(run()).rejects.toBeInstanceOf(SlugAlreadyTakenException);
  });

  it('lets other errors through', async () => {
    const failure = new Error('connection lost');
    orm.save.mockRejectedValue(failure);

    await expect(repository.insert(NEW_DROP)).rejects.toBe(failure);
  });
});
