import { ResponseDto } from '../../common/dto/response.dto.js';
import type { TagResponseDto } from '../dto/out/tag-response.dto.js';
import type { TagWithLinkCount } from '../persistence/tag.repository.js';

export class TagsMapper {
  static toResponse(entry: TagWithLinkCount): ResponseDto<TagResponseDto> {
    return new ResponseDto(TagsMapper.toDto(entry));
  }

  static toListResponse(
    entries: TagWithLinkCount[],
  ): ResponseDto<TagResponseDto[]> {
    return new ResponseDto(entries.map((entry) => TagsMapper.toDto(entry)));
  }

  private static toDto({ tag, linkCount }: TagWithLinkCount): TagResponseDto {
    return {
      id: tag.publicId,
      name: tag.name,
      color: tag.color,
      linkCount,
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString(),
    };
  }
}
