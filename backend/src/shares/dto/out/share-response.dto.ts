import type { FileStatus } from '../../../files/entities/stored-file.entity.js';

export interface ShareResponseDto {
  id: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  disabled: boolean;
  fileCount: number;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShareFileResponseDto {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  status: FileStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface ShareDetailResponseDto extends ShareResponseDto {
  files: ShareFileResponseDto[];
}
