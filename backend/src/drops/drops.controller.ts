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
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import {
  LINK_CREATE_THROTTLE_LIMIT,
  LINK_CREATE_THROTTLE_TTL_MS,
} from '../common/variables.global.js';
import type {
  DropDetailResponseDto,
  DropResponseDto,
} from './dto/out/drop-response.dto.js';
import type { ShareDetailResponseDto } from '../shares/dto/out/share-response.dto.js';
import { SharesMapper } from '../shares/mapper/shares.mapper.js';
import { DropsExceptionFilter } from './filter/drops.exception.filter.js';
import { DropsMapper } from './mapper/drops.mapper.js';
import { DropsService } from './services/drops.service.js';

const CREATE_THROTTLE = {
  default: {
    limit: LINK_CREATE_THROTTLE_LIMIT,
    ttl: LINK_CREATE_THROTTLE_TTL_MS,
  },
};

@ApiTags('Drops')
@ApiCookieAuth()
@Controller('drops')
@UseGuards(JwtAuthGuard)
@UseFilters(DropsExceptionFilter)
export class DropsController {
  constructor(private readonly dropsService: DropsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les dépôts' })
  async list(): Promise<ResponseDto<DropResponseDto[]>> {
    return DropsMapper.toListResponse(await this.dropsService.list());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un dépôt' })
  @ApiNotFoundResponse({
    description: 'Dépôt inconnu.',
    type: ErrorResponseDto,
  })
  async get(
    @Param('id') id: string,
  ): Promise<ResponseDto<DropDetailResponseDto>> {
    return DropsMapper.toDetailResponse(await this.dropsService.get(id));
  }

  @Post()
  @Throttle(CREATE_THROTTLE)
  @ApiOperation({ summary: 'Créer un dépôt (slug auto ou choisi)' })
  @ApiBadRequestResponse({
    description: 'Slug, titre, expiration ou limite invalide.',
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
  ): Promise<ResponseDto<DropResponseDto>> {
    return DropsMapper.toResponse(
      await this.dropsService.create(body, user.id),
    );
  }

  @Post(':id/share')
  @Throttle(CREATE_THROTTLE)
  @ApiOperation({
    summary: 'Créer un partage à partir de fichiers prêts du dépôt',
  })
  @ApiBadRequestResponse({
    description: 'Fichiers, slug, expiration ou limite invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Dépôt ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Slug déjà pris ou fichier pas prêt.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de créations.' })
  async share(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<ShareDetailResponseDto>> {
    return SharesMapper.toDetailResponse(
      await this.dropsService.shareFiles(id, body, user.id),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier slug, titre, expiration, limites ou désactivation',
  })
  @ApiBadRequestResponse({
    description: 'Valeur invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Dépôt inconnu.',
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
  ): Promise<ResponseDto<DropResponseDto>> {
    return DropsMapper.toResponse(
      await this.dropsService.update(id, body, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un dépôt (soft delete)' })
  @ApiNoContentResponse({ description: 'Dépôt supprimé.' })
  @ApiNotFoundResponse({
    description: 'Dépôt inconnu.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.dropsService.remove(id, user.id);
  }

  @Delete(':id/files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un fichier reçu (ou annuler un envoi en cours)',
  })
  @ApiNoContentResponse({ description: 'Fichier supprimé.' })
  @ApiNotFoundResponse({
    description: 'Dépôt ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Stockage injoignable : le fichier est conservé.',
    type: ErrorResponseDto,
  })
  async removeFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.dropsService.removeFile(id, fileId, user.id);
  }
}
