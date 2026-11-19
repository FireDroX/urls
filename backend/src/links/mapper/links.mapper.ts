import { HttpStatus, type HttpRedirectResponse } from '@nestjs/common';
import type { PageResponseDto } from '../../common/dto/page-response.dto.js';
import { ResponseDto } from '../../common/dto/response.dto.js';
import type { ListPage } from '../../common/list-query.js';
import {
  LINK_CHECK_BROKEN_AFTER,
  LINK_STATS_TIME_ZONE,
} from '../../common/variables.global.js';
import { LinkOrganizationMapper } from './link-organization.mapper.js';
import type { LinkCheckResponseDto } from '../dto/out/link-check-response.dto.js';
import type { LinkHealthResponseDto } from '../dto/out/link-health-response.dto.js';
import type {
  LinkLastCheckDto,
  LinkResponseDto,
} from '../dto/out/link-response.dto.js';
import type { LinkCheck } from '../entities/link-check.entity.js';
import type { LinkCheckReport } from '../services/link-checks.service.js';
import type { LinkStatsResponseDto } from '../dto/out/link-stats-response.dto.js';
import type { RedirectView } from '../redirect-view.js';
import type { LinkStats } from '../services/links.service.js';

export class LinksMapper {
  static toRedirect(destination: string): HttpRedirectResponse {
    return { url: destination, statusCode: HttpStatus.FOUND };
  }

  static toResponse(item: RedirectView): ResponseDto<LinkResponseDto> {
    return new ResponseDto(LinksMapper.toDto(item));
  }

  static toListResponse(
    page: ListPage<RedirectView>,
  ): ResponseDto<PageResponseDto<LinkResponseDto>> {
    return new ResponseDto({
      ...page,
      items: page.items.map((item) => LinksMapper.toDto(item)),
    });
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

  static toHealthResponse(broken: number): ResponseDto<LinkHealthResponseDto> {
    return new ResponseDto({ broken });
  }

  private static toLastCheck(check: LinkCheck | null): LinkLastCheckDto | null {
    if (!check) return null;
    return {
      outcome: check.outcome,
      statusCode: check.statusCode,
      errorKind: check.errorKind,
      checkedAt: check.checkedAt.toISOString(),
      broken: check.consecutiveFailures >= LINK_CHECK_BROKEN_AFTER,
    };
  }

  private static toDto({
    link,
    organization,
    check,
  }: RedirectView): LinkResponseDto {
    return {
      id: link.publicId,
      type: link.type,
      destination: link.destination,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      disabled: link.disabled,
      ...LinkOrganizationMapper.toDto(organization),
      lastCheck: LinksMapper.toLastCheck(check),
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }
}
