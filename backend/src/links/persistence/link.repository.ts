import type { Link, LinkType } from '../entities/link.entity.js';

export type NewLink = Pick<
  Link,
  'publicId' | 'type' | 'destination' | 'expiresAt'
>;

export interface LinkRepository {
  findAllByType(type: LinkType): Promise<Link[]>;
  findByPublicId(publicId: string): Promise<Link | null>;
  insert(link: NewLink): Promise<Link>;
  findRedirectsDueForCheck(limit: number): Promise<Link[]>;
  save(link: Link): Promise<Link>;
  saveWithCheckReset(link: Link): Promise<Link>;
  softDelete(id: string): Promise<void>;
}
