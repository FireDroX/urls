import { randomUUID } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import type { Readable } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { FileIdTakenException } from '../../common/exceptions/files/file-id-taken.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotUploadingException } from '../../common/exceptions/files/file-not-uploading.exception.js';
import { FileTooLargeException } from '../../common/exceptions/files/file-too-large.exception.js';
import { UploadIncompleteException } from '../../common/exceptions/files/upload-incomplete.exception.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import { uploadTokenMatches } from '../../common/upload-token.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  generatePublicId,
  isWellFormedLinkId,
} from '../../common/public-id.js';
import {
  FILE_MAX_SIZE_BYTES,
  FILE_PART_SIZE_BYTES,
  FILE_S3_KEY_PREFIX,
  FILES_STORAGE_QUOTA_BYTES,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  SHARE_FILES_MAX,
} from '../../common/variables.global.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import {
  type StartUploadDto,
  startUploadSchema,
} from '../dto/in/start-upload.dto.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import {
  completeParts,
  expectedPartSize,
  parseContentLength,
  parsePartNumber,
  partCountOf,
} from '../file-parts.js';
import { measuredPart } from '../file-streams.js';
import type {
  NewStoredFile,
  StoredFileRepository,
  UploadLimits,
} from '../persistence/stored-file.repository.js';
import {
  type DeletionAudit,
  FileDeletionService,
} from './file-deletion.service.js';
import { FileVerificationService } from './file-verification.service.js';

export interface UploadStart {
  file: StoredFile;
  partSize: number;
  partCount: number;
}

export interface ReceivedPart {
  partNumber: number;
  size: number;
}

export interface IncomingPart extends Readable {
  headers: IncomingHttpHeaders;
}

export interface UploadParts extends UploadStart {
  parts: ReceivedPart[];
}

export const SHARE_UPLOAD_LIMITS: UploadLimits = {
  maxFiles: SHARE_FILES_MAX,
  maxLinkBytes: null,
  quotaBytes: FILES_STORAGE_QUOTA_BYTES,
};

export interface UploadOrigin {
  userId: string | null;
  uploaderName: string | null;
  uploadTokenHash: string | null;
  limitsFor: (link: Link | null) => UploadLimits;
  auditMetadata: Record<string, unknown>;
}

@Injectable()
export class FileUploadsService {
  private readonly logger = new Logger(FileUploadsService.name);

  constructor(
    @Inject('FilesRepository')
    private readonly repository: StoredFileRepository,
    @Inject('StorageService') private readonly storage: StorageService,
    private readonly verification: FileVerificationService,
    private readonly auditLog: AuditLogService,
    private readonly deletion: FileDeletionService,
  ) {}

  async start(
    link: Link,
    input: unknown,
    userId: string,
  ): Promise<UploadStart> {
    return this.open(link, parseDto(startUploadSchema, input), {
      userId,
      uploaderName: null,
      uploadTokenHash: null,
      limitsFor: () => SHARE_UPLOAD_LIMITS,
      auditMetadata: { shareId: link.publicId },
    });
  }

  async open(
    link: Link,
    dto: StartUploadDto,
    origin: UploadOrigin,
  ): Promise<UploadStart> {
    if (dto.size > FILE_MAX_SIZE_BYTES) {
      throw new FileTooLargeException();
    }
    const s3Key = `${FILE_S3_KEY_PREFIX}${randomUUID()}`;
    const uploadId = await this.storage.createMultipartUpload(s3Key);
    let file: StoredFile;
    try {
      file = await this.insertWithGeneratedId({
        linkId: link.id,
        s3Key,
        uploadId,
        name: dto.name,
        size: dto.size,
        sha256: dto.sha256,
        uploaderName: origin.uploaderName,
        uploadTokenHash: origin.uploadTokenHash,
        limitsFor: origin.limitsFor,
      });
    } catch (error) {
      await this.abortQuietly(s3Key, uploadId);
      throw error;
    }
    await this.auditLog.record({
      action: 'files.created',
      userId: origin.userId,
      targetId: file.publicId,
      metadata: { ...origin.auditMetadata, name: file.name, size: file.size },
    });
    return {
      file,
      partSize: FILE_PART_SIZE_BYTES,
      partCount: partCountOf(file.size),
    };
  }

  async uploadPart(
    link: Link,
    filePublicId: string,
    rawPartNumber: string,
    part: IncomingPart,
    uploadToken?: string,
  ): Promise<ReceivedPart> {
    const file = await this.findUploading(link, filePublicId, uploadToken);
    const partNumber = parsePartNumber(rawPartNumber, file.size);
    const size = parseContentLength(
      part.headers['content-length'],
      part.headers['transfer-encoding'],
      expectedPartSize(file.size, partNumber),
    );
    await this.whileUploading(() =>
      this.storage.uploadPart(
        file.s3Key,
        file.uploadId!,
        partNumber,
        measuredPart(part, size),
        size,
      ),
    );
    return { partNumber, size };
  }

  async listParts(
    link: Link,
    filePublicId: string,
    uploadToken?: string,
  ): Promise<UploadParts> {
    const file = await this.findUploading(link, filePublicId, uploadToken);
    const parts = await this.whileUploading(() =>
      this.storage.listParts(file.s3Key, file.uploadId!),
    );
    return {
      file,
      partSize: FILE_PART_SIZE_BYTES,
      partCount: partCountOf(file.size),
      parts: parts.map(({ partNumber, size }) => ({ partNumber, size })),
    };
  }

  async complete(
    link: Link,
    filePublicId: string,
    uploadToken?: string,
  ): Promise<StoredFile> {
    const file = await this.findUploading(link, filePublicId, uploadToken);
    const parts = completeParts(
      await this.whileUploading(() =>
        this.storage.listParts(file.s3Key, file.uploadId!),
      ),
      file.size,
    );
    if (!parts) {
      throw new UploadIncompleteException();
    }
    await this.whileUploading(() =>
      this.storage.completeMultipartUpload(file.s3Key, file.uploadId!, parts),
    );
    const changes = {
      status: 'verifying' as const,
      uploadId: null,
      completedAt: new Date(),
    };
    if (!(await this.repository.transition(file.id, 'uploading', changes))) {
      await this.removeObjectOfDeletedFile(file);
      throw new FileNotUploadingException();
    }
    const verifying = { ...file, ...changes };
    this.verification.schedule(verifying);
    return verifying;
  }

  async remove(
    link: Link,
    filePublicId: string,
    audit: DeletionAudit,
    uploadToken?: string,
  ): Promise<void> {
    const file = await this.find(link, filePublicId, uploadToken);
    if (link.type !== 'drop') {
      await this.deletion.erase(file, link, audit);
      return;
    }
    const tokenHash = file.uploadTokenHash;
    if (
      !tokenHash ||
      !(await this.repository.claimForCancel(file.id, link.id, tokenHash))
    ) {
      throw new FileNotFoundException();
    }
    try {
      await this.deletion.erase(file, link, audit);
    } catch (error) {
      await this.releaseClaimQuietly(file, link, tokenHash);
      throw error;
    }
  }

  private async releaseClaimQuietly(
    file: StoredFile,
    link: Link,
    tokenHash: string,
  ): Promise<void> {
    try {
      await this.repository.releaseCancelClaim(file.id, link.id, tokenHash);
    } catch {
      this.logger.warn(
        `Could not restore the cancel claim of file ${file.publicId}`,
      );
    }
  }

  status(
    link: Link,
    filePublicId: string,
    uploadToken?: string,
  ): Promise<StoredFile> {
    return this.find(link, filePublicId, uploadToken);
  }

  private async find(
    link: Link,
    filePublicId: string,
    uploadToken?: string,
  ): Promise<StoredFile> {
    if (!isWellFormedLinkId(filePublicId)) {
      throw new FileNotFoundException();
    }
    const file = await this.repository.findInLink(link.id, filePublicId);
    if (!file) {
      throw new FileNotFoundException();
    }
    if (
      link.type === 'drop' &&
      !uploadTokenMatches(uploadToken, file.uploadTokenHash)
    ) {
      throw new FileNotFoundException();
    }
    return file;
  }

  private async findUploading(
    link: Link,
    filePublicId: string,
    uploadToken?: string,
  ): Promise<StoredFile> {
    const file = await this.find(link, filePublicId, uploadToken);
    if (file.status !== 'uploading' || !file.uploadId) {
      throw new FileNotUploadingException();
    }
    return file;
  }

  private async whileUploading<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof UploadNotFoundException) {
        throw new FileNotUploadingException();
      }
      throw error;
    }
  }

  private async removeObjectOfDeletedFile(file: StoredFile): Promise<void> {
    try {
      const current = await this.repository.findByIdWithDeleted(file.id);
      if (current?.deletedAt) {
        await this.storage.deleteObject(file.s3Key);
      }
    } catch {
      this.logger.warn(
        `Object ${file.s3Key} may be orphaned after a concurrent deletion`,
      );
    }
  }

  private async abortQuietly(key: string, uploadId: string): Promise<void> {
    try {
      await this.storage.abortMultipartUpload(key, uploadId);
    } catch (error) {
      if (!(error instanceof UploadNotFoundException)) {
        this.logger.warn(`Could not abort multipart upload of ${key}`);
      }
    }
  }

  private async insertWithGeneratedId(
    file: Omit<NewStoredFile, 'publicId'> & {
      limitsFor: UploadOrigin['limitsFor'];
    },
  ): Promise<StoredFile> {
    for (let attempt = 1; ; attempt++) {
      try {
        const { limitsFor, ...newFile } = file;
        return await this.repository.insertWithinLimits(
          { ...newFile, publicId: generatePublicId() },
          limitsFor,
        );
      } catch (error) {
        if (
          !(error instanceof FileIdTakenException) ||
          attempt >= PUBLIC_ID_GENERATION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
