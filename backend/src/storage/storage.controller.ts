import { Controller, Get, Inject, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { StorageUsageResponseDto } from './dto/out/storage-usage-response.dto.js';
import { StorageExceptionFilter } from './filter/storage.exception.filter.js';
import { StorageMapper } from './mapper/storage.mapper.js';
import type { StorageService } from './services/storage.service.js';

@ApiTags('Storage')
@ApiCookieAuth()
@Controller('storage')
@UseGuards(JwtAuthGuard)
@UseFilters(StorageExceptionFilter)
export class StorageController {
  constructor(
    @Inject('StorageService') private readonly storage: StorageService,
  ) {}

  @Get('usage')
  @ApiOperation({ summary: 'Espace utilisé et quota du bucket' })
  @ApiServiceUnavailableResponse({
    description: 'Stockage injoignable.',
    type: ErrorResponseDto,
  })
  async usage(): Promise<ResponseDto<StorageUsageResponseDto>> {
    return StorageMapper.toUsageResponse(await this.storage.getUsage());
  }
}
