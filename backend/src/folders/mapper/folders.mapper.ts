import { ResponseDto } from '../../common/dto/response.dto.js';
import type { FolderResponseDto } from '../dto/out/folder-response.dto.js';
import type { FolderWithLinkCount } from '../persistence/folder.repository.js';

export class FoldersMapper {
  static toResponse(
    entry: FolderWithLinkCount,
  ): ResponseDto<FolderResponseDto> {
    return new ResponseDto(FoldersMapper.toDto(entry));
  }

  static toListResponse(
    entries: FolderWithLinkCount[],
  ): ResponseDto<FolderResponseDto[]> {
    return new ResponseDto(entries.map((entry) => FoldersMapper.toDto(entry)));
  }

  private static toDto({
    folder,
    linkCount,
  }: FolderWithLinkCount): FolderResponseDto {
    return {
      id: folder.publicId,
      name: folder.name,
      linkCount,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }
}
