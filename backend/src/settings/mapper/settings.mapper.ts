import { ResponseDto } from '../../common/dto/response.dto.js';
import type { SettingsResponseDto } from '../dto/out/settings-response.dto.js';
import type { Settings } from '../services/system-settings.service.js';

export class SettingsMapper {
  static toResponse(settings: Settings): ResponseDto<SettingsResponseDto> {
    return new ResponseDto({ locale: settings.locale });
  }
}
