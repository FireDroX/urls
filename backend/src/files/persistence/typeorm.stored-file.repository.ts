import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { FileIdTakenException } from '../../common/exceptions/files/file-id-taken.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { Link } from '../../links/entities/link.entity.js';
import { type FileStatus, StoredFile } from '../entities/stored-file.entity.js';
import type {
  FilesSummary,
  FileTransition,
  NewStoredFile,
  StoredFileRepository,
  UploadLimits,
} from './stored-file.repository.js';

interface SummaryRow {
  linkId: string;
  fileCount: string | number;
  totalSize: string | number | null;
}

const COUNTED_FILES = {
  status: Not<FileStatus>('rejected'),
  deletedAt: IsNull(),
};

@Injectable()
export class TypeormStoredFileRepository implements StoredFileRepository {
  constructor(
    @InjectRepository(StoredFile)
    private readonly repository: Repository<StoredFile>,
  ) {}

  findByLinkId(linkId: string): Promise<StoredFile[]> {
    return this.repository.find({
      where: { linkId },
      order: { createdAt: 'ASC' },
    });
  }

  async summarizeByLinkIds(linkIds: string[]): Promise<FilesSummary[]> {
    if (linkIds.length === 0) {
      return [];
    }
    const rows = await this.repository
      .createQueryBuilder('file')
      .select('file.linkId', 'linkId')
      .addSelect('COUNT(*)', 'fileCount')
      .addSelect('SUM(file.size)', 'totalSize')
      .where('file.linkId IN (:...linkIds)', { linkIds })
      .andWhere('file.deletedAt IS NULL')
      .groupBy('file.linkId')
      .getRawMany<SummaryRow>();
    return rows.map((row) => ({
      linkId: row.linkId,
      fileCount: Number(row.fileCount),
      totalSize: Number(row.totalSize ?? 0),
    }));
  }

  findInLink(linkId: string, publicId: string): Promise<StoredFile | null> {
    return this.repository.findOneBy({ linkId, publicId });
  }

  findByStatus(status: FileStatus): Promise<StoredFile[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: 'ASC' },
    });
  }

  async insertWithinLimits(
    file: NewStoredFile,
    limits: UploadLimits,
  ): Promise<StoredFile> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        await manager
          .getRepository(Link)
          .createQueryBuilder('link')
          .setLock('pessimistic_write')
          .where('link.id = :id', { id: file.linkId })
          .getOne();
        const files = manager.getRepository(StoredFile);
        const linkFiles = await files.countBy({
          ...COUNTED_FILES,
          linkId: file.linkId,
        });
        if (linkFiles >= limits.maxFiles) {
          throw new TooManyFilesException();
        }
        const usedBytes = Number((await files.sum('size', COUNTED_FILES)) ?? 0);
        if (usedBytes + file.size > limits.quotaBytes) {
          throw new StorageQuotaExceededException();
        }
        return files.save(
          files.create({
            ...file,
            status: 'uploading',
            mime: null,
            completedAt: null,
          }),
        );
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new FileIdTakenException();
      }
      throw error;
    }
  }

  async transition(
    id: string,
    from: FileStatus,
    changes: FileTransition,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { id, status: from, deletedAt: IsNull() },
      changes,
    );
    return (result.affected ?? 0) > 0;
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id });
  }
}
