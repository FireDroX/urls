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
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import type { TagResponseDto } from './dto/out/tag-response.dto.js';
import { TagsExceptionFilter } from './filter/tags.exception.filter.js';
import { TagsMapper } from './mapper/tags.mapper.js';
import { TagsService } from './services/tags.service.js';

@ApiTags('Tags')
@ApiCookieAuth()
@Controller('tags')
@UseGuards(JwtAuthGuard)
@UseFilters(TagsExceptionFilter)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les tags avec leur nombre de liens' })
  async list(): Promise<ResponseDto<TagResponseDto[]>> {
    return TagsMapper.toListResponse(await this.tagsService.list());
  }

  @Post()
  @ApiOperation({ summary: 'Créer un tag' })
  @ApiBadRequestResponse({
    description: 'Nom ou couleur invalide.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Nom déjà pris.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<TagResponseDto>> {
    return TagsMapper.toResponse(await this.tagsService.create(body, user.id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renommer ou recolorer un tag' })
  @ApiBadRequestResponse({
    description: 'Valeur invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Tag inconnu.', type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'Nom déjà pris.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<TagResponseDto>> {
    return TagsMapper.toResponse(
      await this.tagsService.update(id, body, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un tag (détaché de ses liens)' })
  @ApiNoContentResponse({ description: 'Tag supprimé.' })
  @ApiNotFoundResponse({ description: 'Tag inconnu.', type: ErrorResponseDto })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.tagsService.remove(id, user.id);
  }
}
