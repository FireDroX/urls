import type { Link } from '../../links/entities/link.entity.js';
import type { ListDropsQuery } from '../dto/in/list-drops-query.dto.js';
import type { ResolvedOrganization } from '../../links/link-organization.js';

export type NewDrop = Pick<
  Link,
  'publicId' | 'title' | 'expiresAt' | 'maxFiles' | 'maxTotalBytes'
>;

export interface DropRepository {
  findPage(
    query: ListDropsQuery,
    now: Date,
  ): Promise<{ items: Link[]; total: number }>;
  findByPublicId(publicId: string): Promise<Link | null>;
  insert(drop: NewDrop, organization: ResolvedOrganization): Promise<Link>;
  save(drop: Link, organization: ResolvedOrganization): Promise<Link>;
  softDelete(id: string): Promise<void>;
}
