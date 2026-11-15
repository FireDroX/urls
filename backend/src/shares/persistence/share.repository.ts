import type { Link } from '../../links/entities/link.entity.js';
import type { ResolvedOrganization } from '../../links/link-organization.js';

export type NewShare = Pick<Link, 'publicId' | 'expiresAt' | 'maxDownloads'>;

export interface ShareRepository {
  findAll(): Promise<Link[]>;
  findByPublicId(publicId: string): Promise<Link | null>;
  insert(share: NewShare, organization: ResolvedOrganization): Promise<Link>;
  save(share: Link, organization: ResolvedOrganization): Promise<Link>;
  softDelete(id: string): Promise<void>;
  incrementDownloadCount(id: string, now: Date): Promise<boolean>;
}
