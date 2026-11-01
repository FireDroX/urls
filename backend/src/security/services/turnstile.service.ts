import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TURNSTILE_TIMEOUT_MS,
  TURNSTILE_VERIFY_URL,
} from '../../common/variables.global.js';

interface TurnstileVerifyResponse {
  success: boolean;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey: string | undefined;

  constructor(configService: ConfigService) {
    this.secretKey = configService.get<string>('TURNSTILE_SECRET_KEY');
    if (!this.secretKey) {
      this.logger.warn(
        'TURNSTILE_SECRET_KEY is not configured: captcha verification is disabled',
      );
    }
  }

  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    if (!this.secretKey) {
      return true;
    }
    if (!token) {
      return false;
    }
    const body = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });
    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }
    try {
      const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
      const result = (await response.json()) as TurnstileVerifyResponse;
      return result.success === true;
    } catch (error) {
      this.logger.error('Turnstile verification request failed', error);
      return false;
    }
  }
}
