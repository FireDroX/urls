import { QueryFailedError, type Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { LinkCheck } from '../entities/link-check.entity.js';
import type { Link } from '../entities/link.entity.js';
import { TypeormLinkRepository } from './typeorm.link.repository.js';

const link = { id: 'link-uuid', publicId: 'abc123' } as Link;

describe('TypeormLinkRepository', () => {
  let builder: Record<string, ReturnType<typeof vi.fn>>;
  let manager: {
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let repository: TypeormLinkRepository;

  beforeEach(() => {
    builder = {};
    for (const name of [
      'leftJoin',
      'where',
      'orderBy',
      'addOrderBy',
      'limit',
    ]) {
      builder[name] = vi.fn().mockReturnValue(builder);
    }
    builder.getMany = vi.fn().mockResolvedValue([link]);
    manager = {
      save: vi.fn().mockResolvedValue(link),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const orm = {
      createQueryBuilder: vi.fn().mockReturnValue(builder),
      manager: {
        transaction: vi.fn((work: (m: typeof manager) => Promise<Link>) =>
          work(manager),
        ),
      },
    };
    repository = new TypeormLinkRepository(orm as unknown as Repository<Link>);
  });

  describe('findRedirectsDueForCheck', () => {
    it('selects live redirects, never-checked first then oldest check, limited', async () => {
      const result = await repository.findRedirectsDueForCheck(50);

      expect(result).toEqual([link]);
      expect(builder.leftJoin).toHaveBeenCalledWith(
        LinkCheck,
        'check',
        'check.linkId = link.id',
      );
      expect(builder.where).toHaveBeenCalledWith('link.type = :type', {
        type: 'redirect',
      });
      expect(builder.orderBy).toHaveBeenCalledWith(
        'check.checkedAt IS NULL',
        'DESC',
      );
      expect(builder.addOrderBy.mock.calls).toEqual([
        ['check.checkedAt', 'ASC'],
        ['link.createdAt', 'ASC'],
      ]);
      expect(builder.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('saveWithCheckReset', () => {
    it('saves the link and drops its check in one transaction', async () => {
      const saved = await repository.saveWithCheckReset(link);

      expect(saved).toBe(link);
      expect(manager.save).toHaveBeenCalledWith(link);
      expect(manager.delete).toHaveBeenCalledWith(LinkCheck, {
        linkId: 'link-uuid',
      });
    });

    it('maps a duplicate entry to SlugAlreadyTakenException', async () => {
      manager.save.mockRejectedValue(
        new QueryFailedError('UPDATE', [], { code: 'ER_DUP_ENTRY' } as Error),
      );

      await expect(repository.saveWithCheckReset(link)).rejects.toBeInstanceOf(
        SlugAlreadyTakenException,
      );
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });
});
