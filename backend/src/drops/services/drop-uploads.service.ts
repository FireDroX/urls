import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { dropState } from '../../common/drop-state.js';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { DropExpiredException } from '../../common/exceptions/drops/drop-expired.exception.js';
import { DropLimitExceededException } from '../../common/exceptions/drops/drop-limit-exceeded.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { LinkBytesLimitExceededException } from '../../common/exceptions/files/link-bytes-limit-exceeded.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import { isWellFormedLinkId } from '../../common/public-id.js';
import { generateUploadToken } from '../../common/upload-token.js';
import type { Visitor } from '../../common/visitor.js';
import { EventsService } from '../../events/services/events.service.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import {
  FileUploadsService,
  type IncomingPart,
  type ReceivedPart,
  type UploadParts,
  type UploadStart,
} from '../../files/services/file-uploads.service.js';
import { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import { TurnstileService } from '../../security/services/turnstile.service.js';
import { dropUploadLimits } from '../drop-upload-limits.js';
import { announceDropUploadSchema } from '../dto/in/announce-drop-upload.dto.js';
import type { DropRepository } from '../persistence/drop.repository.js';

const LIMIT_EXCEPTIONS = [
  TooManyFilesException,
  LinkBytesLimitExceededException,
  StorageQuotaExceededException,
];

@Injectable()
export class DropUploadsService {
  constructor(
    @Inject('DropsRepository')
    private readonly repository: DropRepository,
    private readonly files: FilesService,
    private readonly uploads: FileUploadsService,
    private readonly turnstile: TurnstileService,
    private readonly events: EventsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async announce(
    dropId: string,
    input: unknown,
    visitor: Visitor,
  ): Promise<UploadStart & { uploadToken: string }> {
    const { turnstileToken, uploaderName, ...upload } = parseDto(
      announceDropUploadSchema,
      input,
    );
    if (!(await this.turnstile.verify(turnstileToken, visitor.ip))) {
      throw new InvalidTurnstileTokenException();
    }
    const now = new Date();
    const drop = await this.openDrop(dropId, now);
    const { token, hash } = generateUploadToken();
    const started = await this.withDropLimits(() =>
      this.uploads.open(drop, upload, {
        userId: null,
        uploaderName: uploaderName ?? null,
        uploadTokenHash: hash,
        limitsFor: dropUploadLimits(now),
        auditMetadata: {
          dropId: drop.publicId,
          uploaderName: uploaderName ?? null,
        },
      }),
    );
    return { ...started, uploadToken: token };
  }

  async status(
    dropId: string,
    fileId: string,
    uploadToken: string | undefined,
  ): Promise<StoredFile> {
    const drop = await this.activeDrop(dropId);
    return this.uploads.status(drop, fileId, uploadToken);
  }

  async listParts(
    dropId: string,
    fileId: string,
    uploadToken: string | undefined,
  ): Promise<UploadParts> {
    const drop = await this.activeDrop(dropId);
    return this.uploads.listParts(drop, fileId, uploadToken);
  }

  async uploadPart(
    dropId: string,
    fileId: string,
    partNumber: string,
    part: IncomingPart,
    uploadToken: string | undefined,
  ): Promise<ReceivedPart> {
    const drop = await this.activeDrop(dropId);
    return this.uploads.uploadPart(drop, fileId, partNumber, part, uploadToken);
  }

  async complete(
    dropId: string,
    fileId: string,
    uploadToken: string | undefined,
    visitor: Visitor,
  ): Promise<StoredFile> {
    const drop = await this.activeDrop(dropId);
    const file = await this.withDropLimits(() =>
      this.uploads.complete(drop, fileId, uploadToken),
    );
    void this.events.recordUpload(drop.id, visitor);
    await this.auditLog.record({
      action: 'drops.files.received',
      userId: null,
      targetId: file.publicId,
      metadata: {
        dropId: drop.publicId,
        name: file.name,
        size: file.size,
        uploaderName: file.uploaderName,
      },
    });
    return file;
  }

  async remove(
    dropId: string,
    fileId: string,
    uploadToken: string | undefined,
  ): Promise<void> {
    const drop = await this.activeDrop(dropId);
    await this.uploads.remove(
      drop,
      fileId,
      { action: 'drops.files.cancelled', userId: null },
      uploadToken,
    );
  }

  private async openDrop(dropId: string, now: Date): Promise<Link> {
    const drop = await this.activeDrop(dropId);
    const usages = await this.files.summarizeCountedLinks([drop.id]);
    const usage = usages.get(drop.id) ?? { fileCount: 0, totalSize: 0 };
    if (dropState(drop, usage, now) !== 'open') {
      throw new DropExpiredException();
    }
    return drop;
  }

  private async activeDrop(dropId: string): Promise<Link> {
    if (!isWellFormedLinkId(dropId)) {
      throw new DropNotFoundException();
    }
    const drop = await this.repository.findByPublicId(dropId);
    if (!drop || drop.disabled) {
      throw new DropNotFoundException();
    }
    return drop;
  }

  private async withDropLimits<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await operation();
    } catch (error) {
      if (LIMIT_EXCEPTIONS.some((type) => error instanceof type)) {
        throw new DropLimitExceededException();
      }
      throw error;
    }
  }
}
