import type { LinkType } from '../../../links/entities/link.entity.js';
import type { FileStatus } from '../../entities/stored-file.entity.js';

export interface FileLinkResponseDto {
  type: LinkType;
  publicId: string;
  deleted: boolean;
  disabled: boolean;
  expired: boolean;
}

export interface FileItemResponseDto {
  publicId: string;
  name: string;
  size: number;
  mime: string | null;
  status: FileStatus;
  createdAt: string;
  completedAt: string | null;
  inUse: boolean;
  link: FileLinkResponseDto;
}

export interface FilesSummaryResponseDto {
  quotaUsedBytes: number;
  quotaLimitBytes: number;
  orphanBytes: number;
  storageUsedBytes: number | null;
}

export interface FilesListResponseDto {
  files: FileItemResponseDto[];
  summary: FilesSummaryResponseDto;
}

export interface FileDownloadResponseDto {
  url: string;
}
