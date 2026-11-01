import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Vérifier l'état du serveur" })
  @ApiOkResponse({ description: 'Le serveur répond correctement.' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
