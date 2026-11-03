import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link } from '../../links/entities/link.entity.js';
import { TypeormShareRepository } from './typeorm.share.repository.js';

const NOW = new Date('2026-11-03T12:00:00.000Z');

function updateBuilder(affected: number) {
  const builder = {
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    execute: vi.fn().mockResolvedValue({ affected }),
  };
  for (const method of ['update', 'set', 'where', 'andWhere'] as const) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

describe('TypeormShareRepository', () => {
  let ormRepository: { createQueryBuilder: ReturnType<typeof vi.fn> };
  let repository: TypeormShareRepository;

  beforeEach(() => {
    ormRepository = { createQueryBuilder: vi.fn() };
    repository = new TypeormShareRepository(
      ormRepository as unknown as Repository<Link>,
    );
  });

  describe('incrementDownloadCount', () => {
    it('increments in a single guarded UPDATE under the download limit', async () => {
      const builder = updateBuilder(1);
      ormRepository.createQueryBuilder.mockReturnValue(builder);

      await expect(
        repository.incrementDownloadCount('share-uuid', NOW),
      ).resolves.toBe(true);

      expect(builder.update).toHaveBeenCalledWith(Link);
      const [values] = builder.set.mock.calls[0] as [
        Record<string, () => string>,
      ];
      expect(values.downloadCount()).toBe('download_count + 1');
      expect(values.updatedAt()).toBe('updated_at');
      expect(builder.where).toHaveBeenCalledWith('id = :id', {
        id: 'share-uuid',
      });
      const conditions = builder.andWhere.mock.calls.map(
        ([sql]) => sql as string,
      );
      expect(conditions).toEqual(
        expect.arrayContaining([
          'type = :type',
          'disabled = :disabled',
          'deleted_at IS NULL',
          '(expires_at IS NULL OR expires_at > :now)',
          '(max_downloads IS NULL OR download_count < max_downloads)',
        ]),
      );
      expect(builder.andWhere).toHaveBeenCalledWith(
        '(expires_at IS NULL OR expires_at > :now)',
        { now: NOW },
      );
    });

    it('reports a refused increment when no row matched', async () => {
      ormRepository.createQueryBuilder.mockReturnValue(updateBuilder(0));

      await expect(
        repository.incrementDownloadCount('share-uuid', NOW),
      ).resolves.toBe(false);
    });
  });
});
