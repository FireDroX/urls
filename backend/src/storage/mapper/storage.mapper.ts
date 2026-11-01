import { ResponseDto } from '../../common/dto/response.dto.js';
import type { StorageUsageResponseDto } from '../dto/out/storage-usage-response.dto.js';
import type { StorageUsage } from '../services/storage.service.js';

export class StorageMapper {
  static toUsageResponse(
    usage: StorageUsage,
  ): ResponseDto<StorageUsageResponseDto> {
    return new ResponseDto({
      usedBytes: usage.usedBytes,
      quotaBytes: usage.quotaBytes,
    });
  }
}
