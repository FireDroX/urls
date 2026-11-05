import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import {
  FILE_PART_THROTTLE_LIMIT,
  FILE_START_THROTTLE_LIMIT,
  FILE_UPLOAD_THROTTLE_TTL_MS,
} from '../common/variables.global.js';
import type {
  ReceivedPartResponseDto,
  UploadPartsResponseDto,
  UploadStartedResponseDto,
} from './dto/out/share-file-upload-response.dto.js';
import type { ShareFileResponseDto } from './dto/out/share-response.dto.js';
import { ShareFilesExceptionFilter } from './filter/share-files.exception.filter.js';
import { ShareFilesMapper } from './mapper/share-files.mapper.js';
import { ShareFilesService } from './services/share-files.service.js';

const START_THROTTLE = {
  default: {
    limit: FILE_START_THROTTLE_LIMIT,
    ttl: FILE_UPLOAD_THROTTLE_TTL_MS,
  },
};

const PART_THROTTLE = {
  default: {
    limit: FILE_PART_THROTTLE_LIMIT,
    ttl: FILE_UPLOAD_THROTTLE_TTL_MS,
  },
};

@ApiTags('Shares')
@ApiCookieAuth()
@Controller('shares/:id/files')
@UseGuards(JwtAuthGuard)
@UseFilters(ShareFilesExceptionFilter)
export class ShareFilesController {
  constructor(private readonly shareFilesService: ShareFilesService) {}

  @Post()
  @Throttle(START_THROTTLE)
  @ApiOperation({
    summary: 'Annoncer un fichier (nom, taille, SHA-256) et ouvrir son upload',
  })
  @ApiBadRequestResponse({
    description: 'Nom, taille ou SHA-256 invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Partage inconnu.',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Fichier trop gros, partage plein ou quota atteint.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de requêtes.' })
  async start(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<UploadStartedResponseDto>> {
    return ShareFilesMapper.toUploadStartedResponse(
      await this.shareFilesService.start(id, body, user.id),
    );
  }

  @Get(':fileId/parts')
  @ApiOperation({
    summary: 'Lister les parts déjà reçues pour reprendre un upload',
  })
  @ApiNotFoundResponse({
    description: 'Partage ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le fichier n’est plus en cours d’upload.',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Stockage injoignable.',
    type: ErrorResponseDto,
  })
  async listParts(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ): Promise<ResponseDto<UploadPartsResponseDto>> {
    return ShareFilesMapper.toUploadPartsResponse(
      await this.shareFilesService.listParts(id, fileId),
    );
  }

  @Put(':fileId/parts/:partNumber')
  @Throttle(PART_THROTTLE)
  @ApiOperation({
    summary: 'Envoyer une part (corps brut, Content-Length exact)',
  })
  @ApiBadRequestResponse({
    description: 'Numéro de part ou Content-Length invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Partage ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le fichier n’est plus en cours d’upload.',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Part plus grande que prévu.',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Stockage injoignable.',
    type: ErrorResponseDto,
  })
  async uploadPart(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Param('partNumber') partNumber: string,
    @Req() request: Request,
  ): Promise<ResponseDto<ReceivedPartResponseDto>> {
    return ShareFilesMapper.toReceivedPartResponse(
      await this.shareFilesService.uploadPart(id, fileId, partNumber, request),
    );
  }

  @Post(':fileId/complete')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Finaliser l’upload ; la vérification part en tâche de fond',
  })
  @ApiAcceptedResponse({ description: 'Fichier en vérification.' })
  @ApiNotFoundResponse({
    description: 'Partage ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Parts manquantes ou fichier plus en cours d’upload.',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Quota du bucket dépassé.',
    type: ErrorResponseDto,
  })
  async complete(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ): Promise<ResponseDto<ShareFileResponseDto>> {
    return ShareFilesMapper.toFileResponse(
      await this.shareFilesService.complete(id, fileId),
    );
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Annuler l’upload ou supprimer le fichier (soft delete)',
  })
  @ApiNoContentResponse({ description: 'Fichier supprimé.' })
  @ApiNotFoundResponse({
    description: 'Partage ou fichier inconnu.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.shareFilesService.remove(id, fileId, user.id);
  }
}
