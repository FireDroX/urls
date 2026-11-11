import type { Link } from '../../links/entities/link.entity.js';
import type { FileStatus, StoredFile } from '../entities/stored-file.entity.js';

export interface FilesSummary {
  linkId: string;
  fileCount: number;
  totalSize: number;
}

export type NewStoredFile = Pick<
  StoredFile,
  | 'publicId'
  | 'linkId'
  | 's3Key'
  | 'name'
  | 'size'
  | 'sha256'
  | 'uploadId'
  | 'uploaderName'
  | 'uploadTokenHash'
>;

export interface UploadLimits {
  maxFiles: number;
  maxLinkBytes: number | null;
  quotaBytes: number;
}

export type FileTransition = Partial<
  Pick<StoredFile, 'status' | 'mime' | 'uploadId' | 'completedAt'>
>;

export interface StoredFileRepository {
  findByLinkId(linkId: string): Promise<StoredFile[]>;
  summarizeByLinkIds(linkIds: string[]): Promise<FilesSummary[]>;
  summarizeCountedByLinkIds(linkIds: string[]): Promise<FilesSummary[]>;
  findAllWithLink(): Promise<StoredFile[]>;
  findByPublicIdWithLink(publicId: string): Promise<StoredFile | null>;
  sumCountedBytes(): Promise<number>;
  findInLink(linkId: string, publicId: string): Promise<StoredFile | null>;
  findByIdWithDeleted(id: string): Promise<StoredFile | null>;
  findByStatus(status: FileStatus): Promise<StoredFile[]>;
  insertWithinLimits(
    file: NewStoredFile,
    limitsFor: (link: Link | null) => UploadLimits,
  ): Promise<StoredFile>;
  transition(
    id: string,
    from: FileStatus,
    changes: FileTransition,
  ): Promise<boolean>;
  softDelete(id: string): Promise<void>;
}
