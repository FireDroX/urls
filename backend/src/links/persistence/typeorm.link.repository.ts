import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LinkCheck } from '../entities/link-check.entity.js';
import type { ListLinksQuery } from '../dto/in/list-links-query.dto.js';
import { Link } from '../entities/link.entity.js';
import type { ResolvedOrganization } from '../link-organization.js';
import type { LinkRepository, NewLink } from './link.repository.js';
import { saveWithOrganization } from './link-organization.writer.js';
import { findLinkPage, linkStateClause } from './link-list.query.js';

@Injectable()
export class TypeormLinkRepository implements LinkRepository {
  constructor(
    @InjectRepository(Link)
    private readonly repository: Repository<Link>,
  ) {}

  findPage(
    query: ListLinksQuery,
    now: Date,
  ): Promise<{ items: Link[]; total: number }> {
    return findLinkPage(
      this.repository.createQueryBuilder('link'),
      'redirect',
      query,
      query.state ? linkStateClause(query.state, now) : null,
    );
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

  insert(link: NewLink, organization: ResolvedOrganization): Promise<Link> {
    return this.persist(this.repository.create(link), organization);
  }

  save(link: Link, organization: ResolvedOrganization): Promise<Link> {
    return this.persist(link, organization);
  }

  saveWithCheckReset(
    link: Link,
    organization: ResolvedOrganization,
  ): Promise<Link> {
    return this.repository.manager.transaction(async (manager) => {
      const saved = await saveWithOrganization(manager, link, organization);
      await manager.delete(LinkCheck, { linkId: saved.id });
      return saved;
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id });
  }

  private persist(
    link: Link,
    organization: ResolvedOrganization,
  ): Promise<Link> {
    return this.repository.manager.transaction((manager) =>
      saveWithOrganization(manager, link, organization),
    );
  }
}
