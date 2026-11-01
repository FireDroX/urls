import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import type { SettingsResponseDto } from './dto/out/settings-response.dto.js';
import { SettingsExceptionFilter } from './filter/settings.exception.filter.js';
import { SettingsMapper } from './mapper/settings.mapper.js';
import { SystemSettingsService } from './services/system-settings.service.js';

@ApiTags('Settings')
@Controller('settings')
@UseFilters(SettingsExceptionFilter)
export class SettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Réglages publics (langue de l’interface)' })
  async get(): Promise<ResponseDto<SettingsResponseDto>> {
    return SettingsMapper.toResponse(await this.settingsService.get());
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Modifier un réglage (ex. locale = fr | en)' })
  @ApiNotFoundResponse({
    description: 'Réglage inconnu.',
    type: ErrorResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Valeur non autorisée.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('key') key: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<SettingsResponseDto>> {
    return SettingsMapper.toResponse(
      await this.settingsService.update(key, body, user.id),
    );
  }
}
