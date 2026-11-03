import { ResponseDto } from '../../common/dto/response.dto.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type {
  PublicShareFileResponseDto,
  PublicShareResponseDto,
  ShareDownloadResponseDto,
} from '../dto/out/public-share-response.dto.js';
import type {
  ShareDetailResponseDto,
  ShareFileResponseDto,
  ShareResponseDto,
} from '../dto/out/share-response.dto.js';
import type {
  ShareDetail,
  ShareSummary,
  ShareWithFiles,
} from '../services/shares.service.js';

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
      viewCount: detail.viewCount,
      files: detail.files.map((file) => SharesMapper.toFileDto(file)),
    });
  }

  static toPublicResponse({
    share,
    files,
    fileCount,
    totalSize,
  }: ShareWithFiles): ResponseDto<PublicShareResponseDto> {
    return new ResponseDto({
      id: share.publicId,
      expiresAt: share.expiresAt?.toISOString() ?? null,
      fileCount,
      totalSize,
      files: files.map((file) => SharesMapper.toPublicFileDto(file)),
    });
  }

  static toDownloadResponse(
    url: string,
  ): ResponseDto<ShareDownloadResponseDto> {
    return new ResponseDto({ url });
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

  private static toFileDto(file: StoredFile): ShareFileResponseDto {
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

  private static toPublicFileDto(file: StoredFile): PublicShareFileResponseDto {
    return { id: file.publicId, name: file.name, size: file.size };
  }
}
