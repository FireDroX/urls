import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { Link } from '../../links/entities/link.entity.js';
import type { NewShare, ShareRepository } from './share.repository.js';

const SHARE = 'share';

@Injectable()
export class TypeormShareRepository implements ShareRepository {
  constructor(
    @InjectRepository(Link)
    private readonly repository: Repository<Link>,
  ) {}

  findAll(): Promise<Link[]> {
    return this.repository.find({
      where: { type: SHARE },
      order: { createdAt: 'DESC' },
    });
  }

  findByPublicId(publicId: string): Promise<Link | null> {
    return this.repository.findOneBy({ publicId, type: SHARE });
  }

  insert(share: NewShare): Promise<Link> {
    return this.persist(
      this.repository.create({ ...share, type: SHARE, destination: null }),
    );
  }

  save(share: Link): Promise<Link> {
    return this.persist(share);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id, type: SHARE });
  }

  private async persist(share: Link): Promise<Link> {
    try {
      return await this.repository.save(share);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new SlugAlreadyTakenException();
      }
      throw error;
    }
  }
}
