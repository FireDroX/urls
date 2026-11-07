import type { Link } from '../links/entities/link.entity.js';
import { isLinkExpired } from './link-expiry.js';
import type { DropState } from './variables.global.js';

export interface DropUsage {
  fileCount: number;
  totalSize: number;
}

export function dropState(
  drop: Pick<Link, 'disabled' | 'expiresAt' | 'maxFiles' | 'maxTotalBytes'>,
  usage: DropUsage,
  now: Date,
): DropState {
  if (drop.disabled) return 'disabled';
  if (isLinkExpired(drop, now)) return 'expired';
  const full =
    drop.maxFiles === null ||
    drop.maxTotalBytes === null ||
    usage.fileCount >= drop.maxFiles ||
    usage.totalSize >= drop.maxTotalBytes;
  return full ? 'full' : 'open';
}
