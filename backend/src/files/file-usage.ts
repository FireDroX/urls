import type { Link } from '../links/entities/link.entity.js';

export function isFileInUse(link: Pick<Link, 'type' | 'deletedAt'>): boolean {
  return link.type === 'share' && link.deletedAt === null;
}
