import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import type { PageResponseDto } from '../common/dto/page-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import {
  LINK_CHECK_THROTTLE_LIMIT,
  LINK_CHECK_THROTTLE_TTL_MS,
  LINK_CREATE_THROTTLE_LIMIT,
  LINK_CREATE_THROTTLE_TTL_MS,
  LINK_STATS_DEFAULT_DAYS,
  LINK_STATS_MAX_DAYS,
  LINK_STATS_MIN_DAYS,
} from '../common/variables.global.js';
import type { AllLinkResponseDto } from './dto/out/all-link-response.dto.js';
import type { LinkCheckResponseDto } from './dto/out/link-check-response.dto.js';
import type { LinkHealthResponseDto } from './dto/out/link-health-response.dto.js';
import type { LinkResponseDto } from './dto/out/link-response.dto.js';
import type { LinkStatsResponseDto } from './dto/out/link-stats-response.dto.js';
import { LinksExceptionFilter } from './filter/links.exception.filter.js';
import { LinksMapper } from './mapper/links.mapper.js';
import { LinkChecksService } from './services/link-checks.service.js';
import { LinksService } from './services/links.service.js';

const CREATE_THROTTLE = {
  default: {
    limit: LINK_CREATE_THROTTLE_LIMIT,
    ttl: LINK_CREATE_THROTTLE_TTL_MS,
  },
};

const CHECK_THROTTLE = {
  default: {
    limit: LINK_CHECK_THROTTLE_LIMIT,
    ttl: LINK_CHECK_THROTTLE_TTL_MS,
  },
};

@ApiTags('Links')
@ApiCookieAuth()
@Controller('links')
@UseGuards(JwtAuthGuard)
@UseFilters(LinksExceptionFilter)
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly linkChecksService: LinkChecksService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lister les redirections' })
  async list(
    @Query() query: unknown,
  ): Promise<ResponseDto<PageResponseDto<LinkResponseDto>>> {
    return LinksMapper.toListResponse(await this.linksService.list(query));
  }

  @Get('health')
  @ApiOperation({
    summary: 'Nombre de redirections cassées (non supprimées)',
  })
  async health(): Promise<ResponseDto<LinkHealthResponseDto>> {
    return LinksMapper.toHealthResponse(await this.linksService.health());
  }

  @Get('all')
  @ApiOperation({
    summary: 'Lister les redirections, partages et dépôts ensemble',
  })
  @ApiBadRequestResponse({
    description: 'Paramètre inconnu ou invalide.',
    type: ErrorResponseDto,
  })
  async listAll(
    @Query() query: unknown,
  ): Promise<ResponseDto<PageResponseDto<AllLinkResponseDto>>> {
    return LinksMapper.toAllListResponse(
      await this.linksService.listAll(query),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une redirection' })
  @ApiNotFoundResponse({ description: 'Lien inconnu.', type: ErrorResponseDto })
  async get(@Param('id') id: string): Promise<ResponseDto<LinkResponseDto>> {
    return LinksMapper.toResponse(await this.linksService.detail(id));
  }

  @Get(':id/stats')
  @ApiOperation({
    summary:
      'Clics par jour (UTC), top sources (par hôte) et top pays d’une redirection',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: `Nombre de jours, de ${LINK_STATS_MIN_DAYS} à ${LINK_STATS_MAX_DAYS} (défaut ${LINK_STATS_DEFAULT_DAYS}).`,
  })
  @ApiBadRequestResponse({
    description: 'Nombre de jours invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Lien inconnu.', type: ErrorResponseDto })
  async stats(
    @Param('id') id: string,
    @Query() query: unknown,
  ): Promise<ResponseDto<LinkStatsResponseDto>> {
    return LinksMapper.toStatsResponse(
      await this.linksService.stats(id, query),
    );
  }

  @Post()
  @Throttle(CREATE_THROTTLE)
  @ApiOperation({ summary: 'Créer une redirection (slug auto ou choisi)' })
  @ApiBadRequestResponse({
    description: 'Destination ou slug invalide.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Slug déjà pris.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de créations.' })
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<LinkResponseDto>> {
    return LinksMapper.toResponse(
      await this.linksService.create(body, user.id),
    );
  }

  @Post(':id/check')
  @HttpCode(HttpStatus.OK)
  @Throttle(CHECK_THROTTLE)
  @ApiOperation({
    summary:
      'Vérifier la destination d’une redirection (requête HEAD, redirections suivies, sans jamais contacter une adresse interne)',
  })
  @ApiOkResponse({ description: 'Résultat de la vérification.' })
  @ApiNotFoundResponse({ description: 'Lien inconnu.', type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Trop de vérifications.' })
  async check(
    @Param('id') id: string,
  ): Promise<ResponseDto<LinkCheckResponseDto>> {
    return LinksMapper.toCheckResponse(await this.linkChecksService.check(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier destination, slug, expiration ou désactivation',
  })
  @ApiBadRequestResponse({
    description: 'Valeur invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Lien inconnu.', type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'Slug déjà pris.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<LinkResponseDto>> {
    return LinksMapper.toResponse(
      await this.linksService.update(id, body, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une redirection (soft delete)' })
  @ApiNoContentResponse({ description: 'Lien supprimé.' })
  @ApiNotFoundResponse({ description: 'Lien inconnu.', type: ErrorResponseDto })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.linksService.remove(id, user.id);
  }
}
