import type { FileStatus } from '../../../files/entities/stored-file.entity.js';
import type { DropState } from '../../../common/variables.global.js';

export interface DropResponseDto {
  id: string;
  title: string | null;
  maxTotalBytes: number;
  maxFiles: number;
  expiresAt: string | null;
  disabled: boolean;
  fileCount: number;
  totalSize: number;
  state: DropState;
  createdAt: string;
  updatedAt: string;
}

export interface DropFileResponseDto {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  status: FileStatus;
  uploaderName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DropDetailResponseDto extends DropResponseDto {
  viewCount: number;
  files: DropFileResponseDto[];
}
