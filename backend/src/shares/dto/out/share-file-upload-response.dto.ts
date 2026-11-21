import type { ShareFileResponseDto } from './share-response.dto.js';

export interface UploadStartedResponseDto {
  fileId: string;
  partSize: number;
  partCount: number;
  file: ShareFileResponseDto;
}

export interface ReceivedPartResponseDto {
  partNumber: number;
  size: number;
}

export interface UploadPartsResponseDto {
  fileId: string;
  size: number;
  sha256: string;
  partSize: number;
  partCount: number;
  parts: ReceivedPartResponseDto[];
}
