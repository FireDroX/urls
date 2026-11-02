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
import type { LinkResponseDto } from './dto/out/link-response.dto.js';
import { LinksExceptionFilter } from './filter/links.exception.filter.js';
import { LinksMapper } from './mapper/links.mapper.js';
import { LinksService } from './services/links.service.js';

const CREATE_THROTTLE = {
  default: {
    limit: LINK_CREATE_THROTTLE_LIMIT,
    ttl: LINK_CREATE_THROTTLE_TTL_MS,
  },
};

@ApiTags('Links')
@ApiCookieAuth()
@Controller('links')
@UseGuards(JwtAuthGuard)
@UseFilters(LinksExceptionFilter)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les redirections' })
  async list(): Promise<ResponseDto<LinkResponseDto[]>> {
    return LinksMapper.toListResponse(await this.linksService.list());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une redirection' })
  @ApiNotFoundResponse({ description: 'Lien inconnu.', type: ErrorResponseDto })
  async get(@Param('id') id: string): Promise<ResponseDto<LinkResponseDto>> {
    return LinksMapper.toResponse(await this.linksService.get(id));
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
