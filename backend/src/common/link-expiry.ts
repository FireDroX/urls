import type { Link } from '../links/entities/link.entity.js';

export function isLinkUsedUp(
  link: Pick<Link, 'expiresAt' | 'maxDownloads' | 'downloadCount'>,
  now: Date,
): boolean {
  const expired =
    link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime();
  const exhausted =
    link.maxDownloads !== null && link.downloadCount >= link.maxDownloads;
  return expired || exhausted;
}
