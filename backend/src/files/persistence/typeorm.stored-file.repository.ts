import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoredFile } from '../entities/stored-file.entity.js';
import type {
  FilesSummary,
  StoredFileRepository,
} from './stored-file.repository.js';

interface SummaryRow {
  linkId: string;
  fileCount: string | number;
  totalSize: string | number | null;
}

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
}
