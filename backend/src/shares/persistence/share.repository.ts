import type { Link } from '../../links/entities/link.entity.js';

export type NewShare = Pick<Link, 'publicId' | 'expiresAt' | 'maxDownloads'>;

export interface ShareRepository {
  findAll(): Promise<Link[]>;
  findByPublicId(publicId: string): Promise<Link | null>;
  insert(share: NewShare): Promise<Link>;
  save(share: Link): Promise<Link>;
  softDelete(id: string): Promise<void>;
}
