import { Inject, Injectable } from '@nestjs/common';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { ShareExpiredException } from '../../common/exceptions/shares/share-expired.exception.js';
import { ShareNotFoundException } from '../../common/exceptions/shares/share-not-found.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import { isWellFormedLinkId } from '../../common/public-id.js';
import { SHARE_DOWNLOAD_URL_TTL_SECONDS } from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import { EventsService } from '../../events/services/events.service.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import { TurnstileService } from '../../security/services/turnstile.service.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import { downloadShareFileSchema } from '../dto/in/download-share-file.dto.js';
import type { ShareRepository } from '../persistence/share.repository.js';
import { withFiles, type ShareWithFiles } from './shares.service.js';

function isUsedUp(share: Link, now: Date): boolean {
  const expired =
    share.expiresAt !== null && share.expiresAt.getTime() <= now.getTime();
  const exhausted =
    share.maxDownloads !== null && share.downloadCount >= share.maxDownloads;
  return expired || exhausted;
}

@Injectable()
export class PublicSharesService {
  constructor(
    @Inject('SharesRepository')
    private readonly repository: ShareRepository,
    private readonly files: FilesService,
    private readonly events: EventsService,
    private readonly turnstile: TurnstileService,
    @Inject('StorageService')
    private readonly storage: StorageService,
  ) {}

  async view(publicId: string, visitor: Visitor): Promise<ShareWithFiles> {
    const { share, files } = await this.findAvailable(publicId, new Date());
    void this.events.recordView(share.id, visitor);
    return withFiles(share, files);
  }

  async download(
    publicId: string,
    filePublicId: string,
    input: unknown,
    visitor: Visitor,
  ): Promise<string> {
    const { turnstileToken } = parseDto(downloadShareFileSchema, input);
    if (!(await this.turnstile.verify(turnstileToken, visitor.ip))) {
      throw new InvalidTurnstileTokenException();
    }
    const now = new Date();
    const { share, files } = await this.findAvailable(publicId, now);
    const file = files.find((candidate) => candidate.publicId === filePublicId);
    if (!file) {
      throw new ShareNotFoundException();
    }
    if (!(await this.repository.incrementDownloadCount(share.id, now))) {
      throw new ShareExpiredException();
    }
    void this.events.recordDownload(share.id, visitor);
    return this.storage.getPresignedDownloadUrl(
      file.s3Key,
      file.name,
      SHARE_DOWNLOAD_URL_TTL_SECONDS,
    );
  }

  private async findAvailable(
    publicId: string,
    now: Date,
  ): Promise<{ share: Link; files: StoredFile[] }> {
    if (!isWellFormedLinkId(publicId)) {
      throw new ShareNotFoundException();
    }
    const share = await this.repository.findByPublicId(publicId);
    if (!share || share.disabled) {
      throw new ShareNotFoundException();
    }
    const files = (await this.files.listForLink(share.id)).filter(
      (file) => file.status === 'ready',
    );
    if (files.length === 0) {
      throw new ShareNotFoundException();
    }
    if (isUsedUp(share, now)) {
      throw new ShareExpiredException();
    }
    return { share, files };
  }
}
