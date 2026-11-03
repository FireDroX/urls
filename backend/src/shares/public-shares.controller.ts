import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentVisitor } from '../common/decorators/current-visitor.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import {
  PUBLIC_LINK_CACHE_CONTROL,
  SHARE_DOWNLOAD_THROTTLE_LIMIT,
  SHARE_DOWNLOAD_THROTTLE_TTL_MS,
  SHARE_VIEW_THROTTLE_LIMIT,
  SHARE_VIEW_THROTTLE_TTL_MS,
} from '../common/variables.global.js';
import type { Visitor } from '../common/visitor.js';
import type {
  PublicShareResponseDto,
  ShareDownloadResponseDto,
} from './dto/out/public-share-response.dto.js';
import { SharesExceptionFilter } from './filter/shares.exception.filter.js';
import { SharesMapper } from './mapper/shares.mapper.js';
import { PublicSharesService } from './services/public-shares.service.js';

const VIEW_THROTTLE = {
  default: {
    limit: SHARE_VIEW_THROTTLE_LIMIT,
    ttl: SHARE_VIEW_THROTTLE_TTL_MS,
  },
};

const DOWNLOAD_THROTTLE = {
  default: {
    limit: SHARE_DOWNLOAD_THROTTLE_LIMIT,
    ttl: SHARE_DOWNLOAD_THROTTLE_TTL_MS,
  },
};

@ApiTags('Public shares')
@Controller('public/shares')
@UseFilters(SharesExceptionFilter)
export class PublicSharesController {
  constructor(private readonly publicShares: PublicSharesService) {}

  @Get(':id')
  @Throttle(VIEW_THROTTLE)
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @ApiOperation({ summary: 'Aperçu public d’un partage (fichiers prêts)' })
  @ApiNotFoundResponse({
    description: 'Partage inconnu, désactivé, supprimé ou sans fichier prêt.',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({
    description: 'Partage expiré ou téléchargements épuisés.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de requêtes.' })
  async view(
    @Param('id') id: string,
    @CurrentVisitor() visitor: Visitor,
  ): Promise<ResponseDto<PublicShareResponseDto>> {
    return SharesMapper.toPublicResponse(
      await this.publicShares.view(id, visitor),
    );
  }

  @Post(':id/files/:fileId/download')
  @HttpCode(HttpStatus.OK)
  @Throttle(DOWNLOAD_THROTTLE)
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @ApiOperation({
    summary: 'URL présignée courte de téléchargement (jeton Turnstile)',
  })
  @ApiBadRequestResponse({
    description: 'Corps invalide ou défi Turnstile refusé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Partage ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({
    description: 'Partage expiré ou téléchargements épuisés.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de téléchargements.' })
  async download(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Body() body: unknown,
    @CurrentVisitor() visitor: Visitor,
  ): Promise<ResponseDto<ShareDownloadResponseDto>> {
    return SharesMapper.toDownloadResponse(
      await this.publicShares.download(id, fileId, body, visitor),
    );
  }
}
