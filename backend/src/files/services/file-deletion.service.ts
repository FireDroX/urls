import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type AuditAction,
  AuditLogService,
} from '../../audit/services/audit-log.service.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';

export interface DeletionAudit {
  action: AuditAction;
  userId: string | null;
}

@Injectable()
export class FileDeletionService {
  private readonly logger = new Logger(FileDeletionService.name);

  constructor(
    @Inject('FilesRepository')
    private readonly repository: StoredFileRepository,
    @Inject('StorageService') private readonly storage: StorageService,
    private readonly auditLog: AuditLogService,
  ) {}

  async erase(
    file: StoredFile,
    link: Link,
    audit: DeletionAudit,
  ): Promise<void> {
    await this.removeFromStorage(file);
    await this.repository.softDelete(file.id);
    if (file.status === 'uploading') {
      await this.removeObjectQuietly(file.s3Key);
    }
    await this.auditLog.record({
      action: audit.action,
      userId: audit.userId,
      targetId: file.publicId,
      metadata: {
        linkId: link.publicId,
        linkType: link.type,
        status: file.status,
      },
    });
  }

  private async removeFromStorage(file: StoredFile): Promise<void> {
    if (file.status === 'uploading' && file.uploadId) {
      try {
        await this.storage.abortMultipartUpload(file.s3Key, file.uploadId);
        return;
      } catch (error) {
        if (!(error instanceof UploadNotFoundException)) {
          throw error;
        }
      }
    }
    await this.storage.deleteObject(file.s3Key);
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
