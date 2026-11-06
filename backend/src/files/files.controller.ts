import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import type {
  FileDownloadResponseDto,
  FilesListResponseDto,
} from './dto/out/file-response.dto.js';
import { FilesExceptionFilter } from './filter/files.exception.filter.js';
import { FilesMapper } from './mapper/files.mapper.js';
import { FilesAdminService } from './services/files-admin.service.js';

@ApiTags('Files')
@ApiCookieAuth()
@Controller('files')
@UseGuards(JwtAuthGuard)
@UseFilters(FilesExceptionFilter)
export class FilesController {
  constructor(private readonly filesAdmin: FilesAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les fichiers stockés, leur lien et la place occupée',
  })
  @ApiBadRequestResponse({
    description: 'Paramètre inconnu ou valeur autre que orphans=true.',
    type: ErrorResponseDto,
  })
  async list(
    @Query() query: unknown,
  ): Promise<ResponseDto<FilesListResponseDto>> {
    return FilesMapper.toListResponse(await this.filesAdmin.list(query));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un fichier orphelin du stockage' })
  @ApiNoContentResponse({ description: 'Fichier supprimé.' })
  @ApiNotFoundResponse({
    description: 'Fichier inconnu ou déjà supprimé.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le fichier appartient encore à un partage.',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Stockage injoignable, le fichier reste en place.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.filesAdmin.remove(id, user.id);
  }

  @Post(':id/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'URL présignée courte de téléchargement (admin)' })
  @ApiNotFoundResponse({
    description: 'Fichier inconnu ou supprimé.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le fichier n’est pas prêt.',
    type: ErrorResponseDto,
  })
  async download(
    @Param('id') id: string,
  ): Promise<ResponseDto<FileDownloadResponseDto>> {
    return FilesMapper.toDownloadResponse(
      await this.filesAdmin.createDownloadUrl(id),
    );
  }
}
