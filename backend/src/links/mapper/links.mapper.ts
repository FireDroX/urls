import { HttpStatus, type HttpRedirectResponse } from '@nestjs/common';
import { ResponseDto } from '../../common/dto/response.dto.js';
import type { LinkResponseDto } from '../dto/out/link-response.dto.js';
import type { Link } from '../entities/link.entity.js';

export class LinksMapper {
  static toRedirect(destination: string): HttpRedirectResponse {
    return { url: destination, statusCode: HttpStatus.FOUND };
  }

  static toResponse(link: Link): ResponseDto<LinkResponseDto> {
    return new ResponseDto(LinksMapper.toDto(link));
  }

  static toListResponse(links: Link[]): ResponseDto<LinkResponseDto[]> {
    return new ResponseDto(links.map((link) => LinksMapper.toDto(link)));
  }

  private static toDto(link: Link): LinkResponseDto {
    return {
      id: link.publicId,
      type: link.type,
      destination: link.destination,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      disabled: link.disabled,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }
}
