import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Link } from '../../links/entities/link.entity.js';
import type { ResolvedOrganization } from '../../links/link-organization.js';
import { saveWithOrganization } from '../../links/persistence/link-organization.writer.js';
import type { ListSharesQuery } from '../dto/in/list-shares-query.dto.js';
import {
  findLinkPage,
  shareStateClause,
} from '../../links/persistence/link-list.query.js';
import type { NewShare, ShareRepository } from './share.repository.js';

const SHARE = 'share';

@Injectable()
export class TypeormShareRepository implements ShareRepository {
  constructor(
    @InjectRepository(Link)
    private readonly repository: Repository<Link>,
  ) {}

  findPage(
    query: ListSharesQuery,
    now: Date,
  ): Promise<{ items: Link[]; total: number }> {
    return findLinkPage(
      this.repository.createQueryBuilder('link'),
      SHARE,
      query,
      query.state ? shareStateClause(query.state, now) : null,
    );
  }

  findByPublicId(publicId: string): Promise<Link | null> {
    return this.repository.findOneBy({ publicId, type: SHARE });
  }

  insert(share: NewShare, organization: ResolvedOrganization): Promise<Link> {
    return this.persist(
      this.repository.create({ ...share, type: SHARE, destination: null }),
      organization,
    );
  }

  save(share: Link, organization: ResolvedOrganization): Promise<Link> {
    return this.persist(share, organization);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id, type: SHARE });
  }

  async incrementDownloadCount(id: string, now: Date): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Link)
      .set({
        downloadCount: () => 'download_count + 1',
        updatedAt: () => 'updated_at',
      })
      .where('id = :id', { id })
      .andWhere('type = :type', { type: SHARE })
      .andWhere('disabled = :disabled', { disabled: false })
      .andWhere('deleted_at IS NULL')
      .andWhere('(expires_at IS NULL OR expires_at > :now)', { now })
      .andWhere('(max_downloads IS NULL OR download_count < max_downloads)')
      .execute();
    return result.affected === 1;
  }

  private persist(
    share: Link,
    organization: ResolvedOrganization,
  ): Promise<Link> {
    return this.repository.manager.transaction((manager) =>
      saveWithOrganization(manager, share, organization),
    );
  }
}
