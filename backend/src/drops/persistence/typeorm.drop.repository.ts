import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Link } from '../../links/entities/link.entity.js';
import type { ResolvedOrganization } from '../../links/link-organization.js';
import { saveWithOrganization } from '../../links/persistence/link-organization.writer.js';
import type { ListDropsQuery } from '../dto/in/list-drops-query.dto.js';
import {
  dropStateClause,
  findLinkPage,
} from '../../links/persistence/link-list.query.js';
import type { DropRepository, NewDrop } from './drop.repository.js';

const DROP = 'drop';

@Injectable()
export class TypeormDropRepository implements DropRepository {
  constructor(
    @InjectRepository(Link)
    private readonly repository: Repository<Link>,
  ) {}

  findPage(
    query: ListDropsQuery,
    now: Date,
  ): Promise<{ items: Link[]; total: number }> {
    return findLinkPage(
      this.repository.createQueryBuilder('link'),
      DROP,
      query,
      query.state ? dropStateClause(query.state, now) : null,
    );
  }

  findByPublicId(publicId: string): Promise<Link | null> {
    return this.repository.findOneBy({ publicId, type: DROP });
  }

  insert(drop: NewDrop, organization: ResolvedOrganization): Promise<Link> {
    return this.persist(
      this.repository.create({ ...drop, type: DROP, destination: null }),
      organization,
    );
  }

  save(drop: Link, organization: ResolvedOrganization): Promise<Link> {
    return this.persist(drop, organization);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id, type: DROP });
  }

  private persist(
    drop: Link,
    organization: ResolvedOrganization,
  ): Promise<Link> {
    return this.repository.manager.transaction((manager) =>
      saveWithOrganization(manager, drop, organization),
    );
  }
}
