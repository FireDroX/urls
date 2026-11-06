import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';

@Injectable()
export class FileDeletionService {
  private readonly logger = new Logger(FileDeletionService.name);

  constructor(
    @Inject('FilesRepository')
    private readonly repository: StoredFileRepository,
    @Inject('StorageService') private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  async erase(file: StoredFile, link: Link, userId: string): Promise<void> {
    const aborted = await this.removeFromStorage(file);
    await this.repository.softDelete(file.id);
    if (aborted) {
      await this.removeObjectQuietly(file.s3Key);
    }
    await this.auditLog.record({
      action: 'files.deleted',
      userId,
      targetId: file.publicId,
      metadata: {
        linkId: link.publicId,
        linkType: link.type,
        status: file.status,
      },
    });
  }

  private async removeFromStorage(file: StoredFile): Promise<boolean> {
    if (file.status === 'uploading' && file.uploadId) {
      try {
        await this.storage.abortMultipartUpload(file.s3Key, file.uploadId);
        return true;
      } catch (error) {
        if (!(error instanceof UploadNotFoundException)) {
          throw error;
        }
      }
    }
    await this.storage.deleteObject(file.s3Key);
    return false;
  }

  private async removeObjectQuietly(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch {
      this.logger.warn(
        `Object ${key} may be orphaned after a concurrent upload completion`,
      );
    }
  }
}
