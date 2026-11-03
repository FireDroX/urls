import { ResponseDto } from '../../common/dto/response.dto.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type {
  ShareDetailResponseDto,
  ShareFileResponseDto,
  ShareResponseDto,
} from '../dto/out/share-response.dto.js';
import type { ShareDetail, ShareSummary } from '../services/shares.service.js';

export class SharesMapper {
  static toListResponse(
    summaries: ShareSummary[],
  ): ResponseDto<ShareResponseDto[]> {
    return new ResponseDto(
      summaries.map((summary) => SharesMapper.toDto(summary)),
    );
  }

  static toDetailResponse(
    detail: ShareDetail,
  ): ResponseDto<ShareDetailResponseDto> {
    return new ResponseDto({
      ...SharesMapper.toDto(detail),
      files: detail.files.map((file) => SharesMapper.toFileDto(file)),
    });
  }

  private static toDto({
    share,
    fileCount,
    totalSize,
  }: ShareSummary): ShareResponseDto {
    return {
      id: share.publicId,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      maxDownloads: share.maxDownloads,
      downloadCount: share.downloadCount,
      disabled: share.disabled,
      fileCount,
      totalSize,
      createdAt: share.createdAt.toISOString(),
      updatedAt: share.updatedAt.toISOString(),
    };
  }

  static toFileDto(file: StoredFile): ShareFileResponseDto {
    return {
      id: file.publicId,
      name: file.name,
      size: file.size,
      mime: file.mime,
      status: file.status,
      createdAt: file.createdAt.toISOString(),
      completedAt: file.completedAt?.toISOString() ?? null,
    };
  }
}
