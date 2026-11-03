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
