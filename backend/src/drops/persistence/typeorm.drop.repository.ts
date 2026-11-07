import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { Link } from '../../links/entities/link.entity.js';
import type { DropRepository, NewDrop } from './drop.repository.js';

const DROP = 'drop';

@Injectable()
export class TypeormDropRepository implements DropRepository {
  constructor(
    @InjectRepository(Link)
    private readonly repository: Repository<Link>,
  ) {}

  findAll(): Promise<Link[]> {
    return this.repository.find({
      where: { type: DROP },
      order: { createdAt: 'DESC' },
    });
  }

  findByPublicId(publicId: string): Promise<Link | null> {
    return this.repository.findOneBy({ publicId, type: DROP });
  }

  insert(drop: NewDrop): Promise<Link> {
    return this.persist(
      this.repository.create({ ...drop, type: DROP, destination: null }),
    );
  }

  save(drop: Link): Promise<Link> {
    return this.persist(drop);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id, type: DROP });
  }

  private async persist(drop: Link): Promise<Link> {
    try {
      return await this.repository.save(drop);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new SlugAlreadyTakenException();
      }
      throw error;
    }
  }
}
