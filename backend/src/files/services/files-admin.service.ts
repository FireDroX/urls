import { Inject, Injectable } from '@nestjs/common';
import { FileInUseException } from '../../common/exceptions/files/file-in-use.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotReadyException } from '../../common/exceptions/files/file-not-ready.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { isLinkUsedUp } from '../../common/link-expiry.js';
import { parseDto } from '../../common/parse-dto.js';
import { isWellFormedLinkId } from '../../common/public-id.js';
import {
  FILE_DOWNLOAD_URL_TTL_SECONDS,
  FILES_STORAGE_QUOTA_BYTES,
} from '../../common/variables.global.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import { listFilesQuerySchema } from '../dto/in/list-files-query.dto.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import { isFileInUse } from '../file-usage.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';
import { FileDeletionService } from './file-deletion.service.js';

export interface FileEntry {
  file: StoredFile;
  inUse: boolean;
  expired: boolean;
}

export interface FilesOverview {
  files: FileEntry[];
  summary: {
    quotaUsedBytes: number;
    quotaLimitBytes: number;
    orphanBytes: number;
    storageUsedBytes: number | null;
  };
}

@Injectable()
export class FilesAdminService {
  constructor(
    @Inject('FilesRepository')
    private readonly repository: StoredFileRepository,
    @Inject('StorageService') private readonly storage: StorageService,
    private readonly deletion: FileDeletionService,
  ) {}

  async list(query: unknown): Promise<FilesOverview> {
    const { orphans } = parseDto(listFilesQuerySchema, query);
    const [files, quotaUsedBytes, storageUsedBytes] = await Promise.all([
      this.repository.findAllWithLink(),
      this.repository.sumCountedBytes(),
      this.readStorageUsedBytes(),
    ]);
    const now = new Date();
    const entries = files.map((file) => ({
      file,
      inUse: isFileInUse(file.link!),
      expired: isLinkUsedUp(file.link!, now),
    }));
    const orphanBytes = entries
      .filter(({ inUse, file }) => !inUse && file.status !== 'rejected')
      .reduce((total, { file }) => total + file.size, 0);
    return {
      files: orphans ? entries.filter(({ inUse }) => !inUse) : entries,
      summary: {
        quotaUsedBytes,
        quotaLimitBytes: FILES_STORAGE_QUOTA_BYTES,
        orphanBytes,
        storageUsedBytes,
      },
    };
  }

  async remove(publicId: string, userId: string): Promise<void> {
    const file = await this.find(publicId);
    if (isFileInUse(file.link!)) {
      throw new FileInUseException();
    }
    await this.deletion.erase(file, file.link!, userId);
  }

  async createDownloadUrl(publicId: string): Promise<string> {
    const file = await this.find(publicId);
    if (file.status !== 'ready') {
      throw new FileNotReadyException();
    }
    return this.storage.getPresignedDownloadUrl(
      file.s3Key,
      file.name,
      FILE_DOWNLOAD_URL_TTL_SECONDS,
    );
  }

  private async find(publicId: string): Promise<StoredFile> {
    if (!isWellFormedLinkId(publicId)) {
      throw new FileNotFoundException();
    }
    const file = await this.repository.findByPublicIdWithLink(publicId);
    if (!file) {
      throw new FileNotFoundException();
    }
    return file;
  }

  private async readStorageUsedBytes(): Promise<number | null> {
    try {
      return (await this.storage.getUsage()).usedBytes;
    } catch (error) {
      if (error instanceof StorageUnavailableException) {
        return null;
      }
      throw error;
    }
  }
}
