import { DropExpiredException } from '../common/exceptions/drops/drop-expired.exception.js';
import { DropLimitExceededException } from '../common/exceptions/drops/drop-limit-exceeded.exception.js';
import { DropNotFoundException } from '../common/exceptions/drops/drop-not-found.exception.js';
import { isLinkExpired } from '../common/link-expiry.js';
import { FILES_STORAGE_QUOTA_BYTES } from '../common/variables.global.js';
import type { UploadLimits } from '../files/persistence/stored-file.repository.js';
import type { Link } from '../links/entities/link.entity.js';

export function dropUploadLimits(
  now: Date,
): (link: Link | null) => UploadLimits {
  return (link) => {
    if (!link || link.type !== 'drop' || link.disabled) {
      throw new DropNotFoundException();
    }
    if (isLinkExpired(link, now)) {
      throw new DropExpiredException();
    }
    if (link.maxFiles === null || link.maxTotalBytes === null) {
      throw new DropLimitExceededException();
    }
    return {
      maxFiles: link.maxFiles,
      maxLinkBytes: link.maxTotalBytes,
      quotaBytes: FILES_STORAGE_QUOTA_BYTES,
    };
  };
}
