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
import { startUploadSchema } from '../dto/in/start-upload.dto.js';
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
} from '../persistence/stored-file.repository.js';
import { FileDeletionService } from './file-deletion.service.js';
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

const UPLOAD_LIMITS = {
  maxFiles: SHARE_FILES_MAX,
  quotaBytes: FILES_STORAGE_QUOTA_BYTES,
};

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
    const dto = parseDto(startUploadSchema, input);
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
      });
    } catch (error) {
      await this.abortQuietly(s3Key, uploadId);
      throw error;
    }
    await this.auditLog.record({
      action: 'files.created',
      userId,
      targetId: file.publicId,
      metadata: { shareId: link.publicId, name: file.name, size: file.size },
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
  ): Promise<ReceivedPart> {
    const file = await this.findUploading(link, filePublicId);
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

  async listParts(link: Link, filePublicId: string): Promise<UploadParts> {
    const file = await this.findUploading(link, filePublicId);
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

  async complete(link: Link, filePublicId: string): Promise<StoredFile> {
    const file = await this.findUploading(link, filePublicId);
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
      throw new FileNotUploadingException();
    }
    const verifying = { ...file, ...changes };
    this.verification.schedule(verifying);
    return verifying;
  }

  async remove(
    link: Link,
    filePublicId: string,
    userId: string,
  ): Promise<void> {
    const file = await this.find(link, filePublicId);
    await this.deletion.erase(file, link, userId);
  }

  private async find(link: Link, filePublicId: string): Promise<StoredFile> {
    if (!isWellFormedLinkId(filePublicId)) {
      throw new FileNotFoundException();
    }
    const file = await this.repository.findInLink(link.id, filePublicId);
    if (!file) {
      throw new FileNotFoundException();
    }
    return file;
  }

  private async findUploading(
    link: Link,
    filePublicId: string,
  ): Promise<StoredFile> {
    const file = await this.find(link, filePublicId);
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
    file: Omit<NewStoredFile, 'publicId'>,
  ): Promise<StoredFile> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repository.insertWithinLimits(
          { ...file, publicId: generatePublicId() },
          UPLOAD_LIMITS,
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
