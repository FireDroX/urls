import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { LinkCheck } from '../entities/link-check.entity.js';
import { Link, type LinkType } from '../entities/link.entity.js';
import type { LinkRepository, NewLink } from './link.repository.js';

@Injectable()
export class TypeormLinkRepository implements LinkRepository {
  constructor(
    @InjectRepository(Link)
    private readonly repository: Repository<Link>,
  ) {}

  findAllByType(type: LinkType): Promise<Link[]> {
    return this.repository.find({
      where: { type },
      order: { createdAt: 'DESC' },
    });
  }

  findByPublicId(publicId: string): Promise<Link | null> {
    return this.repository.findOneBy({ publicId });
  }

  findRedirectsDueForCheck(limit: number): Promise<Link[]> {
    return this.repository
      .createQueryBuilder('link')
      .leftJoin(LinkCheck, 'check', 'check.linkId = link.id')
      .where('link.type = :type', { type: 'redirect' })
      .orderBy('check.checkedAt IS NULL', 'DESC')
      .addOrderBy('check.checkedAt', 'ASC')
      .addOrderBy('link.createdAt', 'ASC')
      .limit(limit)
      .getMany();
  }

  insert(link: NewLink): Promise<Link> {
    return this.persist(this.repository.create(link));
  }

  save(link: Link): Promise<Link> {
    return this.persist(link);
  }

  async saveWithCheckReset(link: Link): Promise<Link> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const saved = await manager.save(link);
        await manager.delete(LinkCheck, { linkId: link.id });
        return saved;
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new SlugAlreadyTakenException();
      }
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id });
  }

  private async persist(link: Link): Promise<Link> {
    try {
      return await this.repository.save(link);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new SlugAlreadyTakenException();
      }
      throw error;
    }
  }
}
