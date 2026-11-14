import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TagNameAlreadyTakenException } from '../../common/exceptions/tags/tag-name-already-taken.exception.js';
import { TagPublicIdTakenException } from '../../common/exceptions/tags/tag-public-id-taken.exception.js';
import type { Tag } from '../entities/tag.entity.js';
import { TypeormTagRepository } from './typeorm.tag.repository.js';

const NEW_TAG = {
  publicId: 'abc123',
  name: 'Work',
  nameKey: 'work',
  color: '#112233',
};

function duplicate(index: string): QueryFailedError {
  return new QueryFailedError('INSERT', [], {
    code: 'ER_DUP_ENTRY',
    sqlMessage: `Duplicate entry 'x' for key 'tags.${index}'`,
  } as unknown as Error);
}

describe('TypeormTagRepository', () => {
  let typeorm: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormTagRepository;

  beforeEach(() => {
    typeorm = {
      create: vi.fn((tag: unknown) => tag),
      save: vi.fn((tag: unknown) => Promise.resolve(tag)),
      findOneBy: vi.fn().mockResolvedValue(null),
      createQueryBuilder: vi.fn(),
    };
    repository = new TypeormTagRepository(
      typeorm as unknown as Repository<Tag>,
    );
  });

  describe('insert', () => {
    it('throws TagNameAlreadyTakenException on a name key duplicate', async () => {
      typeorm.save.mockRejectedValue(duplicate('UQ_tags_name_key'));

      await expect(repository.insert(NEW_TAG)).rejects.toBeInstanceOf(
        TagNameAlreadyTakenException,
      );
    });

    it('throws TagPublicIdTakenException on a public id duplicate', async () => {
      typeorm.save.mockRejectedValue(duplicate('UQ_tags_public_id'));

      await expect(repository.insert(NEW_TAG)).rejects.toBeInstanceOf(
        TagPublicIdTakenException,
      );
    });

    it('rethrows any other error', async () => {
      const failure = new Error('connection lost');
      typeorm.save.mockRejectedValue(failure);

      await expect(repository.insert(NEW_TAG)).rejects.toBe(failure);
    });
  });

  it('looks tags up by name key', async () => {
    await repository.findByNameKey('work');

    expect(typeorm.findOneBy).toHaveBeenCalledWith({ nameKey: 'work' });
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
      const tag = { id: 't1' } as Tag;
      typeorm.createQueryBuilder.mockReturnValue(
        queryBuilder({ entities: [tag], raw: [{ linkCount: '4' }] }),
      );

      await expect(repository.listWithLinkCounts()).resolves.toEqual([
        { tag, linkCount: 4 },
      ]);
    });

    it('converts the aggregated linkCount to a number for one tag', async () => {
      typeorm.createQueryBuilder.mockReturnValue(
        queryBuilder({ linkCount: '2' }),
      );

      await expect(repository.countLinks('t1')).resolves.toBe(2);
    });
  });
});
