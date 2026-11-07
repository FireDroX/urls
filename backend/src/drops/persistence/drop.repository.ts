import type { Link } from '../../links/entities/link.entity.js';

export type NewDrop = Pick<
  Link,
  'publicId' | 'title' | 'expiresAt' | 'maxFiles' | 'maxTotalBytes'
>;

export interface DropRepository {
  findAll(): Promise<Link[]>;
  findByPublicId(publicId: string): Promise<Link | null>;
  insert(drop: NewDrop): Promise<Link>;
  save(drop: Link): Promise<Link>;
  softDelete(id: string): Promise<void>;
}
