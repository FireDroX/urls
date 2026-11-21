import { ResponseDto } from '../../common/dto/response.dto.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type {
  ReceivedPart,
  UploadParts,
  UploadStart,
} from '../../files/services/file-uploads.service.js';
import type {
  ReceivedPartResponseDto,
  UploadPartsResponseDto,
} from '../../shares/dto/out/share-file-upload-response.dto.js';
import type { ShareFileResponseDto } from '../../shares/dto/out/share-response.dto.js';
import { ShareFilesMapper } from '../../shares/mapper/share-files.mapper.js';
import { SharesMapper } from '../../shares/mapper/shares.mapper.js';
import type { DropUploadStartedResponseDto } from '../dto/out/drop-upload-response.dto.js';

export class DropUploadsMapper {
  static toUploadStartedResponse({
    file,
    partSize,
    partCount,
    uploadToken,
  }: UploadStart & {
    uploadToken: string;
  }): ResponseDto<DropUploadStartedResponseDto> {
    return new ResponseDto({
      fileId: file.publicId,
      partSize,
      partCount,
      file: SharesMapper.toFileDto(file),
      uploadToken,
    });
  }

  static toReceivedPartResponse(
    part: ReceivedPart,
  ): ResponseDto<ReceivedPartResponseDto> {
    return ShareFilesMapper.toReceivedPartResponse(part);
  }

  static toUploadPartsResponse(
    parts: UploadParts,
  ): ResponseDto<UploadPartsResponseDto> {
    return ShareFilesMapper.toUploadPartsResponse(parts);
  }

  static toFileResponse(file: StoredFile): ResponseDto<ShareFileResponseDto> {
    return ShareFilesMapper.toFileResponse(file);
  }
}
