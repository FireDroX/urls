import type { Link } from '../links/entities/link.entity.js';

export function isLinkExpired(
  link: Pick<Link, 'expiresAt'>,
  now: Date,
): boolean {
  return link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime();
}

export function isLinkUsedUp(
  link: Pick<Link, 'expiresAt' | 'maxDownloads' | 'downloadCount'>,
  now: Date,
): boolean {
  const exhausted =
    link.maxDownloads !== null && link.downloadCount >= link.maxDownloads;
  return isLinkExpired(link, now) || exhausted;
}
