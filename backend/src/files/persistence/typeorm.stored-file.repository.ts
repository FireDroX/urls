import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotReadyException } from '../../common/exceptions/files/file-not-ready.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { FileIdTakenException } from '../../common/exceptions/files/file-id-taken.exception.js';
import { LinkBytesLimitExceededException } from '../../common/exceptions/files/link-bytes-limit-exceeded.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { Link } from '../../links/entities/link.entity.js';
import { type FileStatus, StoredFile } from '../entities/stored-file.entity.js';
import type {
  FilesSummary,
  FileTransition,
  MovedToShare,
  NewSharedFiles,
  NewStoredFile,
  StoredFileRepository,
  UploadLimits,
} from './stored-file.repository.js';

interface SummaryRow {
  linkId: string;
  fileCount: string | number;
  totalSize: string | number | null;
}

const REJECTED: FileStatus = 'rejected';

const COUNTED_FILES = {
  status: Not<FileStatus>(REJECTED),
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

  summarizeByLinkIds(linkIds: string[]): Promise<FilesSummary[]> {
    return this.summarize(linkIds, false);
  }

  summarizeCountedByLinkIds(linkIds: string[]): Promise<FilesSummary[]> {
    return this.summarize(linkIds, true);
  }

  private async summarize(
    linkIds: string[],
    countedOnly: boolean,
  ): Promise<FilesSummary[]> {
    if (linkIds.length === 0) {
      return [];
    }
    const query = this.repository
      .createQueryBuilder('file')
      .select('file.linkId', 'linkId')
      .addSelect('COUNT(*)', 'fileCount')
      .addSelect('SUM(file.size)', 'totalSize')
      .where('file.linkId IN (:...linkIds)', { linkIds })
      .andWhere('file.deletedAt IS NULL');
    if (countedOnly) {
      query.andWhere('file.status <> :rejected', { rejected: REJECTED });
    }
    const rows = await query.groupBy('file.linkId').getRawMany<SummaryRow>();
    return rows.map((row) => ({
      linkId: row.linkId,
      fileCount: Number(row.fileCount),
      totalSize: Number(row.totalSize ?? 0),
    }));
  }

  findAllWithLink(): Promise<StoredFile[]> {
    return this.withLink()
      .orderBy('file.createdAt', 'DESC')
      .addOrderBy('file.publicId', 'ASC')
      .getMany();
  }

  findByPublicIdWithLink(publicId: string): Promise<StoredFile | null> {
    return this.withLink()
      .andWhere('file.publicId = :publicId', { publicId })
      .getOne();
  }

  sumCountedBytes(): Promise<number> {
    return this.sumCounted(this.repository);
  }

  findInLink(linkId: string, publicId: string): Promise<StoredFile | null> {
    return this.repository.findOneBy({ linkId, publicId });
  }

  findByIdWithDeleted(id: string): Promise<StoredFile | null> {
    return this.repository.findOne({ where: { id }, withDeleted: true });
  }

  findByStatus(status: FileStatus): Promise<StoredFile[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: 'ASC' },
    });
  }

  async insertWithinLimits(
    file: NewStoredFile,
    limitsFor: (link: Link | null) => UploadLimits,
  ): Promise<StoredFile> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const link = await manager
          .getRepository(Link)
          .createQueryBuilder('link')
          .setLock('pessimistic_write')
          .where('link.id = :id', { id: file.linkId })
          .getOne();
        const limits = limitsFor(link);
        const files = manager.getRepository(StoredFile);
        const linkFiles = await files.countBy({
          ...COUNTED_FILES,
          linkId: file.linkId,
        });
        if (linkFiles >= limits.maxFiles) {
          throw new TooManyFilesException();
        }
        if (limits.maxLinkBytes !== null) {
          const linkBytes = Number(
            (await files.sum('size', {
              ...COUNTED_FILES,
              linkId: file.linkId,
            })) ?? 0,
          );
          if (linkBytes + file.size > limits.maxLinkBytes) {
            throw new LinkBytesLimitExceededException();
          }
        }
        const usedBytes = await this.sumCounted(files);
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

  async moveToNewShare(
    dropId: string,
    filePublicIds: string[],
    share: NewSharedFiles,
    closeDrop: boolean,
  ): Promise<MovedToShare> {
    try {
      return await this.repository.manager.transaction(async (manager) => {
        const links = manager.getRepository(Link);
        const drop = await links
          .createQueryBuilder('link')
          .setLock('pessimistic_write')
          .where('link.id = :id', { id: dropId })
          .getOne();
        if (!drop || drop.type !== 'drop' || drop.deletedAt) {
          throw new DropNotFoundException();
        }
        const files = manager.getRepository(StoredFile);
        const moved = await files.find({
          where: {
            linkId: drop.id,
            publicId: In(filePublicIds),
            deletedAt: IsNull(),
            uploadTokenHash: Not(IsNull()),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (moved.length !== filePublicIds.length) {
          throw new FileNotFoundException();
        }
        if (moved.some((file) => file.status !== 'ready')) {
          throw new FileNotReadyException();
        }
        const created = await links.save(
          links.create({ ...share, type: 'share', destination: null }),
        );
        await files.update(
          { id: In(moved.map((file) => file.id)) },
          { linkId: created.id, uploadTokenHash: null },
        );
        if (closeDrop) {
          await links.update({ id: drop.id }, { disabled: true });
        }
        return {
          share: created,
          files: moved.map((file) =>
            Object.assign(file, { linkId: created.id, uploadTokenHash: null }),
          ),
        };
      });
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new SlugAlreadyTakenException();
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

  async claimForCancel(
    id: string,
    linkId: string,
    uploadTokenHash: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { id, linkId, uploadTokenHash, deletedAt: IsNull() },
      { uploadTokenHash: null },
    );
    return (result.affected ?? 0) > 0;
  }

  async releaseCancelClaim(
    id: string,
    linkId: string,
    uploadTokenHash: string,
  ): Promise<void> {
    await this.repository.update(
      { id, linkId, uploadTokenHash: IsNull(), deletedAt: IsNull() },
      { uploadTokenHash },
    );
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id });
  }

  private withLink() {
    return this.repository
      .createQueryBuilder('file')
      .withDeleted()
      .innerJoinAndSelect('file.link', 'link')
      .where('file.deletedAt IS NULL');
  }

  private async sumCounted(files: Repository<StoredFile>): Promise<number> {
    return Number((await files.sum('size', COUNTED_FILES)) ?? 0);
  }
}
