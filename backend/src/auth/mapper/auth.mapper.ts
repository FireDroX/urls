import { ResponseDto } from '../../common/dto/response.dto.js';
import type { User } from '../../users/entities/user.entity.js';
import type { MeResponseDto } from '../dto/out/me-response.dto.js';

export class AuthMapper {
  static toMeResponse(user: Pick<User, 'email'>): ResponseDto<MeResponseDto> {
    return new ResponseDto({ email: user.email });
  }
}
