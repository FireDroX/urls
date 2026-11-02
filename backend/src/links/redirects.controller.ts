import {
  Controller,
  Get,
  Header,
  type HttpRedirectResponse,
  HttpStatus,
  Param,
  Redirect,
  UseFilters,
} from '@nestjs/common';
import {
  ApiFoundResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import {
  LINK_REDIRECT_THROTTLE_LIMIT,
  LINK_REDIRECT_THROTTLE_TTL_MS,
  PUBLIC_LINK_CACHE_CONTROL,
} from '../common/variables.global.js';
import { LinksExceptionFilter } from './filter/links.exception.filter.js';
import { LinksMapper } from './mapper/links.mapper.js';
import { LinksService } from './services/links.service.js';

const REDIRECT_THROTTLE = {
  default: {
    limit: LINK_REDIRECT_THROTTLE_LIMIT,
    ttl: LINK_REDIRECT_THROTTLE_TTL_MS,
  },
};

@ApiTags('Redirects')
@Controller('r')
@UseFilters(LinksExceptionFilter)
export class RedirectsController {
  constructor(private readonly linksService: LinksService) {}

  @Get(':id')
  @Throttle(REDIRECT_THROTTLE)
  @Header('Cache-Control', PUBLIC_LINK_CACHE_CONTROL)
  @Redirect(undefined, HttpStatus.FOUND)
  @ApiOperation({ summary: 'Rediriger vers la destination (302, public)' })
  @ApiFoundResponse({ description: 'Redirection vers la destination.' })
  @ApiNotFoundResponse({
    description: 'Lien inconnu, désactivé ou supprimé.',
    type: ErrorResponseDto,
  })
  @ApiGoneResponse({ description: 'Lien expiré.', type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Trop de requêtes.' })
  async redirect(@Param('id') id: string): Promise<HttpRedirectResponse> {
    return LinksMapper.toRedirect(await this.linksService.resolveRedirect(id));
  }
}
