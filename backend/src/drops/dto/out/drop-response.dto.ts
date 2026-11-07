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
