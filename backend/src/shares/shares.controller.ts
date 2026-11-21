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
  ApiNotFoundResponse,
  ApiOperation,
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
  LINK_CREATE_THROTTLE_LIMIT,
  LINK_CREATE_THROTTLE_TTL_MS,
} from '../common/variables.global.js';
import type {
  ShareDetailResponseDto,
  ShareResponseDto,
} from './dto/out/share-response.dto.js';
import { SharesExceptionFilter } from './filter/shares.exception.filter.js';
import { SharesMapper } from './mapper/shares.mapper.js';
import { SharesService } from './services/shares.service.js';

const CREATE_THROTTLE = {
  default: {
    limit: LINK_CREATE_THROTTLE_LIMIT,
    ttl: LINK_CREATE_THROTTLE_TTL_MS,
  },
};

@ApiTags('Shares')
@ApiCookieAuth()
@Controller('shares')
@UseGuards(JwtAuthGuard)
@UseFilters(SharesExceptionFilter)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les partages' })
  async list(
    @Query() query: unknown,
  ): Promise<ResponseDto<PageResponseDto<ShareResponseDto>>> {
    return SharesMapper.toListResponse(await this.sharesService.list(query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un partage et de ses fichiers' })
  @ApiNotFoundResponse({
    description: 'Partage inconnu.',
    type: ErrorResponseDto,
  })
  async get(
    @Param('id') id: string,
  ): Promise<ResponseDto<ShareDetailResponseDto>> {
    return SharesMapper.toDetailResponse(await this.sharesService.get(id));
  }

  @Post()
  @Throttle(CREATE_THROTTLE)
  @ApiOperation({ summary: 'Créer un partage (slug auto ou choisi)' })
  @ApiBadRequestResponse({
    description: 'Slug, expiration ou limite invalide.',
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
  ): Promise<ResponseDto<ShareDetailResponseDto>> {
    return SharesMapper.toDetailResponse(
      await this.sharesService.create(body, user.id),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier slug, expiration, téléchargements max ou désactivation',
  })
  @ApiBadRequestResponse({
    description: 'Valeur invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Partage inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Slug déjà pris.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<ShareDetailResponseDto>> {
    return SharesMapper.toDetailResponse(
      await this.sharesService.update(id, body, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un partage (soft delete)' })
  @ApiNoContentResponse({ description: 'Partage supprimé.' })
  @ApiNotFoundResponse({
    description: 'Partage inconnu.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.sharesService.remove(id, user.id);
  }
}
