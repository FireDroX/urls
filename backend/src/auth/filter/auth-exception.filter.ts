import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccountLockedException } from '../../common/exceptions/auth/account-locked.exception.js';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

const STATUS_BY_EXCEPTION: Record<string, number> = {
  ValidationException: HttpStatus.BAD_REQUEST,
  InvalidTurnstileTokenException: HttpStatus.BAD_REQUEST,
  WeakPasswordException: HttpStatus.UNPROCESSABLE_ENTITY,
  InvalidCredentialsException: HttpStatus.UNAUTHORIZED,
  InvalidRefreshTokenException: HttpStatus.UNAUTHORIZED,
};

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AccountLockedException) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((exception.lockedUntil.getTime() - Date.now()) / 1000),
      );
      response.setHeader('Retry-After', String(retryAfterSeconds));
      HttpExceptionFilter.send(response, HttpStatus.LOCKED, exception.message);
      return;
    }

    const status = STATUS_BY_EXCEPTION[exception.name];
    if (status === undefined) {
      HttpExceptionFilter.respond(exception, response);
      return;
    }
    HttpExceptionFilter.send(response, status, exception.message);
  }
}
