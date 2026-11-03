import { HttpStatus, type HttpRedirectResponse } from '@nestjs/common';
import { ResponseDto } from '../../common/dto/response.dto.js';
import { LINK_STATS_TIME_ZONE } from '../../common/variables.global.js';
import type { LinkResponseDto } from '../dto/out/link-response.dto.js';
import type { LinkStatsResponseDto } from '../dto/out/link-stats-response.dto.js';
import type { Link } from '../entities/link.entity.js';
import type { LinkStats } from '../services/links.service.js';

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

  static toStatsResponse(stats: LinkStats): ResponseDto<LinkStatsResponseDto> {
    const { since, total, daily, refererHosts, countries } = stats.clicks;
    return new ResponseDto({
      id: stats.link.publicId,
      days: stats.days,
      since,
      timeZone: LINK_STATS_TIME_ZONE,
      total,
      daily: daily.map(({ day, clicks }) => ({ date: day, clicks })),
      referers: refererHosts.map(({ value, clicks }) => ({
        host: value,
        clicks,
      })),
      countries: countries.map(({ value, clicks }) => ({
        country: value,
        clicks,
      })),
    });
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
