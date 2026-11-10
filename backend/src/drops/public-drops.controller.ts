import { Controller, Get, Header, Param, UseFilters } from '@nestjs/common';
import {
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
  DROP_VIEW_THROTTLE_LIMIT,
  DROP_VIEW_THROTTLE_TTL_MS,
  PUBLIC_LINK_CACHE_CONTROL,
} from '../common/variables.global.js';
import type { Visitor } from '../common/visitor.js';
import type { PublicDropResponseDto } from './dto/out/public-drop-response.dto.js';
import { DropsExceptionFilter } from './filter/drops.exception.filter.js';
import { DropsMapper } from './mapper/drops.mapper.js';
import { PublicDropsService } from './services/public-drops.service.js';

@ApiTags('Public drops')
@Controller('public/drops')
@UseFilters(DropsExceptionFilter)
export class PublicDropsController {
  constructor(private readonly publicDrops: PublicDropsService) {}

  @Get(':id')
  @Throttle({
    default: {
      limit: DROP_VIEW_THROTTLE_LIMIT,
      ttl: DROP_VIEW_THROTTLE_TTL_MS,
    },
  })
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @ApiOperation({ summary: 'Aperçu public d’un dépôt (place restante)' })
  @ApiNotFoundResponse({
    description: 'Dépôt inconnu, désactivé, supprimé ou d’un autre type.',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({
    description: 'Dépôt expiré ou plein.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de requêtes.' })
  async view(
    @Param('id') id: string,
    @CurrentVisitor() visitor: Visitor,
  ): Promise<ResponseDto<PublicDropResponseDto>> {
    return DropsMapper.toPublicResponse(
      await this.publicDrops.view(id, visitor),
    );
  }
}
