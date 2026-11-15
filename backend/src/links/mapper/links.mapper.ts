import { HttpStatus, type HttpRedirectResponse } from '@nestjs/common';
import { ResponseDto } from '../../common/dto/response.dto.js';
import { LINK_STATS_TIME_ZONE } from '../../common/variables.global.js';
import { LinkOrganizationMapper } from './link-organization.mapper.js';
import type { LinkCheckResponseDto } from '../dto/out/link-check-response.dto.js';
import type { LinkResponseDto } from '../dto/out/link-response.dto.js';
import type { LinkCheckReport } from '../services/link-checks.service.js';
import type { LinkStatsResponseDto } from '../dto/out/link-stats-response.dto.js';
import type { LinkWithOrganization } from '../link-organization.js';
import type { LinkStats } from '../services/links.service.js';

export class LinksMapper {
  static toRedirect(destination: string): HttpRedirectResponse {
    return { url: destination, statusCode: HttpStatus.FOUND };
  }

  static toResponse(item: LinkWithOrganization): ResponseDto<LinkResponseDto> {
    return new ResponseDto(LinksMapper.toDto(item));
  }

  static toListResponse(
    items: LinkWithOrganization[],
  ): ResponseDto<LinkResponseDto[]> {
    return new ResponseDto(items.map((item) => LinksMapper.toDto(item)));
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

  static toCheckResponse({
    link,
    check,
  }: LinkCheckReport): ResponseDto<LinkCheckResponseDto> {
    return new ResponseDto({
      id: link.publicId,
      outcome: check.outcome,
      statusCode: check.statusCode,
      errorKind: check.errorKind,
      consecutiveFailures: check.consecutiveFailures,
      checkedAt: check.checkedAt.toISOString(),
    });
  }

  private static toDto({
    link,
    organization,
  }: LinkWithOrganization): LinkResponseDto {
    return {
      id: link.publicId,
      type: link.type,
      destination: link.destination,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      disabled: link.disabled,
      ...LinkOrganizationMapper.toDto(organization),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }
}
