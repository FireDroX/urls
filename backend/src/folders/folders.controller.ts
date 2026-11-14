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
import type { FolderResponseDto } from './dto/out/folder-response.dto.js';
import { FoldersExceptionFilter } from './filter/folders.exception.filter.js';
import { FoldersMapper } from './mapper/folders.mapper.js';
import { FoldersService } from './services/folders.service.js';

@ApiTags('Folders')
@ApiCookieAuth()
@Controller('folders')
@UseGuards(JwtAuthGuard)
@UseFilters(FoldersExceptionFilter)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les dossiers avec leur nombre de liens' })
  async list(): Promise<ResponseDto<FolderResponseDto[]>> {
    return FoldersMapper.toListResponse(await this.foldersService.list());
  }

  @Post()
  @ApiOperation({ summary: 'Créer un dossier' })
  @ApiBadRequestResponse({
    description: 'Nom invalide.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Nom déjà pris.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<FolderResponseDto>> {
    return FoldersMapper.toResponse(
      await this.foldersService.create(body, user.id),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renommer un dossier' })
  @ApiBadRequestResponse({
    description: 'Nom invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Dossier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Nom déjà pris.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<FolderResponseDto>> {
    return FoldersMapper.toResponse(
      await this.foldersService.update(id, body, user.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un dossier (détaché de ses liens)' })
  @ApiNoContentResponse({ description: 'Dossier supprimé.' })
  @ApiNotFoundResponse({
    description: 'Dossier inconnu.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.foldersService.remove(id, user.id);
  }
}
