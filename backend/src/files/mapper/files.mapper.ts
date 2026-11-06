import { ResponseDto } from '../../common/dto/response.dto.js';
import type {
  FileDownloadResponseDto,
  FileItemResponseDto,
  FilesListResponseDto,
} from '../dto/out/file-response.dto.js';
import type {
  FileEntry,
  FilesOverview,
} from '../services/files-admin.service.js';

export class FilesMapper {
  static toListResponse({
    files,
    summary,
  }: FilesOverview): ResponseDto<FilesListResponseDto> {
    return new ResponseDto({
      files: files.map((entry) => FilesMapper.toItemDto(entry)),
      summary: {
        quotaUsedBytes: summary.quotaUsedBytes,
        quotaLimitBytes: summary.quotaLimitBytes,
        orphanBytes: summary.orphanBytes,
        storageUsedBytes: summary.storageUsedBytes,
      },
    });
  }

  static toDownloadResponse(url: string): ResponseDto<FileDownloadResponseDto> {
    return new ResponseDto({ url });
  }

  private static toItemDto({
    file,
    inUse,
    expired,
  }: FileEntry): FileItemResponseDto {
    const link = file.link!;
    return {
      publicId: file.publicId,
      name: file.name,
      size: file.size,
      mime: file.mime,
      status: file.status,
      createdAt: file.createdAt.toISOString(),
      completedAt: file.completedAt?.toISOString() ?? null,
      inUse,
      link: {
        type: link.type,
        publicId: link.publicId,
        deleted: link.deletedAt !== null,
        disabled: link.disabled,
        expired,
      },
    };
  }
}
