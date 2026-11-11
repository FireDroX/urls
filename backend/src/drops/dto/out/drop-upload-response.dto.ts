import type { UploadStartedResponseDto } from '../../../shares/dto/out/share-file-upload-response.dto.js';

export interface DropUploadStartedResponseDto extends UploadStartedResponseDto {
  uploadToken: string;
}
