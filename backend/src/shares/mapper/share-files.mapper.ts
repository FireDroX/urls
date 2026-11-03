import { ResponseDto } from '../../common/dto/response.dto.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type {
  ReceivedPart,
  UploadStart,
} from '../../files/services/file-uploads.service.js';
import type {
  ReceivedPartResponseDto,
  UploadStartedResponseDto,
} from '../dto/out/share-file-upload-response.dto.js';
import type { ShareFileResponseDto } from '../dto/out/share-response.dto.js';
import { SharesMapper } from './shares.mapper.js';

export class ShareFilesMapper {
  static toUploadStartedResponse({
    file,
    partSize,
    partCount,
  }: UploadStart): ResponseDto<UploadStartedResponseDto> {
    return new ResponseDto({
      fileId: file.publicId,
      partSize,
      partCount,
      file: SharesMapper.toFileDto(file),
    });
  }

  static toReceivedPartResponse(
    part: ReceivedPart,
  ): ResponseDto<ReceivedPartResponseDto> {
    return new ResponseDto({ partNumber: part.partNumber, size: part.size });
  }

  static toFileResponse(file: StoredFile): ResponseDto<ShareFileResponseDto> {
    return new ResponseDto(SharesMapper.toFileDto(file));
  }
}
