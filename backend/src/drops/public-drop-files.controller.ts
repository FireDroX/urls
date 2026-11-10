import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentVisitor } from '../common/decorators/current-visitor.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import {
  DROP_UPLOAD_PART_THROTTLE_LIMIT,
  DROP_UPLOAD_START_THROTTLE_LIMIT,
  DROP_UPLOAD_THROTTLE_TTL_MS,
  DROP_UPLOAD_TOKEN_HEADER,
  PUBLIC_LINK_CACHE_CONTROL,
} from '../common/variables.global.js';
import type { Visitor } from '../common/visitor.js';
import type { DropUploadStartedResponseDto } from './dto/out/drop-upload-response.dto.js';
import { DropUploadsExceptionFilter } from './filter/drop-uploads.exception.filter.js';
import { DropUploadsMapper } from './mapper/drop-uploads.mapper.js';
import { DropUploadsService } from './services/drop-uploads.service.js';
import type {
  ReceivedPartResponseDto,
  UploadPartsResponseDto,
} from '../shares/dto/out/share-file-upload-response.dto.js';
import type { ShareFileResponseDto } from '../shares/dto/out/share-response.dto.js';

const START_THROTTLE = {
  default: {
    limit: DROP_UPLOAD_START_THROTTLE_LIMIT,
    ttl: DROP_UPLOAD_THROTTLE_TTL_MS,
  },
};

const PART_THROTTLE = {
  default: {
    limit: DROP_UPLOAD_PART_THROTTLE_LIMIT,
    ttl: DROP_UPLOAD_THROTTLE_TTL_MS,
  },
};

@ApiTags('Public drops')
@Controller('public/drops/:id/files')
@UseFilters(DropUploadsExceptionFilter)
export class PublicDropFilesController {
  constructor(private readonly dropUploads: DropUploadsService) {}

  @Post()
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @Throttle(START_THROTTLE)
  @ApiOperation({
    summary:
      'Annoncer un fichier dans un dépôt (Turnstile) et ouvrir son envoi',
  })
  @ApiBadRequestResponse({
    description: 'Champs invalides ou captcha refusé.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Dépôt inconnu, désactivé ou supprimé.',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({
    description: 'Dépôt expiré ou plein.',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Fichier trop gros ou limites du dépôt dépassées.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de requêtes.' })
  async announce(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentVisitor() visitor: Visitor,
  ): Promise<ResponseDto<DropUploadStartedResponseDto>> {
    return DropUploadsMapper.toUploadStartedResponse(
      await this.dropUploads.announce(id, body, visitor),
    );
  }

  @Get(':fileId')
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @ApiOperation({ summary: 'Statut d’un fichier envoyé' })
  @ApiNotFoundResponse({
    description: 'Dépôt, fichier ou jeton inconnu.',
    type: ErrorResponseDto,
  })
  async status(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Headers(DROP_UPLOAD_TOKEN_HEADER) uploadToken: string | undefined,
  ): Promise<ResponseDto<ShareFileResponseDto>> {
    return DropUploadsMapper.toFileResponse(
      await this.dropUploads.status(id, fileId, uploadToken),
    );
  }

  @Get(':fileId/parts')
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @ApiOperation({ summary: 'Lister les parts reçues pour reprendre un envoi' })
  @ApiNotFoundResponse({
    description: 'Dépôt, fichier ou jeton inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le fichier n’est plus en cours d’envoi.',
    type: ErrorResponseDto,
  })
  async listParts(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Headers(DROP_UPLOAD_TOKEN_HEADER) uploadToken: string | undefined,
  ): Promise<ResponseDto<UploadPartsResponseDto>> {
    return DropUploadsMapper.toUploadPartsResponse(
      await this.dropUploads.listParts(id, fileId, uploadToken),
    );
  }

  @Put(':fileId/parts/:partNumber')
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @Throttle(PART_THROTTLE)
  @ApiOperation({
    summary: 'Envoyer une part (corps brut, Content-Length exact)',
  })
  @ApiBadRequestResponse({
    description: 'Numéro de part ou Content-Length invalide.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Dépôt, fichier ou jeton inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Le fichier n’est plus en cours d’envoi.',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Part plus grande que prévu.',
    type: ErrorResponseDto,
  })
  async uploadPart(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Param('partNumber') partNumber: string,
    @Headers(DROP_UPLOAD_TOKEN_HEADER) uploadToken: string | undefined,
    @Req() request: Request,
  ): Promise<ResponseDto<ReceivedPartResponseDto>> {
    return DropUploadsMapper.toReceivedPartResponse(
      await this.dropUploads.uploadPart(
        id,
        fileId,
        partNumber,
        request,
        uploadToken,
      ),
    );
  }

  @Post(':fileId/complete')
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Finaliser l’envoi ; la vérification suit' })
  @ApiAcceptedResponse({ description: 'Fichier en vérification.' })
  @ApiNotFoundResponse({
    description: 'Dépôt, fichier ou jeton inconnu.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Parts manquantes ou fichier plus en cours d’envoi.',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description: 'Limites du dépôt dépassées.',
    type: ErrorResponseDto,
  })
  async complete(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Headers(DROP_UPLOAD_TOKEN_HEADER) uploadToken: string | undefined,
    @CurrentVisitor() visitor: Visitor,
  ): Promise<ResponseDto<ShareFileResponseDto>> {
    return DropUploadsMapper.toFileResponse(
      await this.dropUploads.complete(id, fileId, uploadToken, visitor),
    );
  }

  @Delete(':fileId')
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Annuler l’envoi ou supprimer le fichier envoyé' })
  @ApiNoContentResponse({ description: 'Fichier supprimé.' })
  @ApiNotFoundResponse({
    description: 'Dépôt, fichier ou jeton inconnu.',
    type: ErrorResponseDto,
  })
  async remove(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Headers(DROP_UPLOAD_TOKEN_HEADER) uploadToken: string | undefined,
  ): Promise<void> {
    await this.dropUploads.remove(id, fileId, uploadToken);
  }
}
