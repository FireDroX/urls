import type { StoredFile } from '../entities/stored-file.entity.js';

export interface FilesSummary {
  linkId: string;
  fileCount: number;
  totalSize: number;
}

export interface StoredFileRepository {
  findByLinkId(linkId: string): Promise<StoredFile[]>;
  summarizeByLinkIds(linkIds: string[]): Promise<FilesSummary[]>;
}
