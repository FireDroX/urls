import { ResponseDto } from '../../common/dto/response.dto.js';
import { LinkOrganizationMapper } from '../../links/mapper/link-organization.mapper.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type {
  DropDetailResponseDto,
  DropFileResponseDto,
  DropResponseDto,
} from '../dto/out/drop-response.dto.js';
import type { PublicDropResponseDto } from '../dto/out/public-drop-response.dto.js';
import type { PublicDropView } from '../services/public-drops.service.js';
import type { DropDetail, DropSummary } from '../services/drops.service.js';

export class DropsMapper {
  static toListResponse(
    summaries: DropSummary[],
  ): ResponseDto<DropResponseDto[]> {
    return new ResponseDto(
      summaries.map((summary) => DropsMapper.toDto(summary)),
    );
  }

  static toResponse(summary: DropSummary): ResponseDto<DropResponseDto> {
    return new ResponseDto(DropsMapper.toDto(summary));
  }

  static toDetailResponse(
    detail: DropDetail,
  ): ResponseDto<DropDetailResponseDto> {
    return new ResponseDto({
      ...DropsMapper.toDto(detail),
      viewCount: detail.viewCount,
      files: detail.files.map((file) => DropsMapper.toFileDto(file)),
    });
  }

  static toFileDto(file: StoredFile): DropFileResponseDto {
    return {
      id: file.publicId,
      name: file.name,
      size: file.size,
      mime: file.mime,
      status: file.status,
      uploaderName: file.uploaderName,
      createdAt: file.createdAt.toISOString(),
      completedAt: file.completedAt?.toISOString() ?? null,
    };
  }

  static toPublicResponse({
    drop,
    filesRemaining,
    bytesRemaining,
  }: PublicDropView): ResponseDto<PublicDropResponseDto> {
    return new ResponseDto({
      id: drop.publicId,
      title: drop.title,
      maxFiles: drop.maxFiles ?? 0,
      maxTotalBytes: drop.maxTotalBytes ?? 0,
      filesRemaining,
      bytesRemaining,
      expiresAt: drop.expiresAt?.toISOString() ?? null,
    });
  }

  private static toDto({
    drop,
    organization,
    fileCount,
    totalSize,
    state,
  }: DropSummary): DropResponseDto {
    return {
      id: drop.publicId,
      title: drop.title,
      maxTotalBytes: drop.maxTotalBytes ?? 0,
      maxFiles: drop.maxFiles ?? 0,
      expiresAt: drop.expiresAt?.toISOString() ?? null,
      disabled: drop.disabled,
      ...LinkOrganizationMapper.toDto(organization),
      fileCount,
      totalSize,
      state,
      createdAt: drop.createdAt.toISOString(),
      updatedAt: drop.updatedAt.toISOString(),
    };
  }
}
