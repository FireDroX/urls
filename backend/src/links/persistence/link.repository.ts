import type { Link } from '../entities/link.entity.js';
import type { ListLinksQuery } from '../dto/in/list-links-query.dto.js';
import type { ResolvedOrganization } from '../link-organization.js';

export type NewLink = Pick<
  Link,
  'publicId' | 'type' | 'destination' | 'expiresAt'
>;

export interface LinkRepository {
  findPage(
    query: ListLinksQuery,
    now: Date,
  ): Promise<{ items: Link[]; total: number }>;
  findByPublicId(publicId: string): Promise<Link | null>;
  insert(link: NewLink, organization: ResolvedOrganization): Promise<Link>;
  findRedirectsDueForCheck(limit: number): Promise<Link[]>;
  save(link: Link, organization: ResolvedOrganization): Promise<Link>;
  saveWithCheckReset(
    link: Link,
    organization: ResolvedOrganization,
  ): Promise<Link>;
  softDelete(id: string): Promise<void>;
}
