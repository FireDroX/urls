import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import {
  FILE_MIME_SNIFF_BYTES,
  FILE_UNKNOWN_MIME,
} from '../../common/variables.global.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { FileStatus, StoredFile } from '../entities/stored-file.entity.js';
import { digestObject } from '../file-streams.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';

type Inspection =
  { valid: true; mime: string } | { valid: false; reason: string };

@Injectable()
export class FileVerificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FileVerificationService.name);

  constructor(
    @Inject('FilesRepository')
    private readonly repository: StoredFileRepository,
    @Inject('StorageService') private readonly storage: StorageService,
  ) {}

  onApplicationBootstrap(): void {
    void this.resumePending();
  }

  schedule(file: StoredFile): void {
    void this.verify(file);
  }

  async verify(file: StoredFile): Promise<FileStatus | null> {
    try {
      const inspection = await this.inspect(file);
      if (inspection.valid) {
        await this.repository.transition(file.id, 'verifying', {
          status: 'ready',
          mime: inspection.mime,
        });
        return 'ready';
      }
      this.logger.warn(`File ${file.publicId} rejected: ${inspection.reason}`);
      await this.repository.transition(file.id, 'verifying', {
        status: 'rejected',
      });
      await this.storage.deleteObject(file.s3Key);
      return 'rejected';
    } catch (error) {
      this.logger.error(`Could not verify file ${file.publicId}`, error);
      return null;
    }
  }

  private async resumePending(): Promise<void> {
    try {
      for (const file of await this.repository.findByStatus('verifying')) {
        await this.verify(file);
      }
    } catch (error) {
      this.logger.error('Could not resume pending verifications', error);
    }
  }

  private async inspect(file: StoredFile): Promise<Inspection> {
    const storedSize = await this.storage.getObjectSize(file.s3Key);
    if (storedSize !== file.size) {
      return {
        valid: false,
        reason: `size ${storedSize} instead of ${file.size}`,
      };
    }
    const digest = await digestObject(
      await this.storage.openObjectStream(file.s3Key),
      FILE_MIME_SNIFF_BYTES,
    );
    if (digest.sha256 !== file.sha256) {
      return { valid: false, reason: 'SHA-256 mismatch' };
    }
    const detected = await fileTypeFromBuffer(digest.head);
    return { valid: true, mime: detected?.mime ?? FILE_UNKNOWN_MIME };
  }
}
