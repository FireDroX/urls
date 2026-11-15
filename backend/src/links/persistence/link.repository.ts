import type { Link, LinkType } from '../entities/link.entity.js';
import type { ResolvedOrganization } from '../link-organization.js';

export type NewLink = Pick<
  Link,
  'publicId' | 'type' | 'destination' | 'expiresAt'
>;

export interface LinkRepository {
  findAllByType(type: LinkType): Promise<Link[]>;
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
