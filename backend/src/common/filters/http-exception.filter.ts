import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private static readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    HttpExceptionFilter.respond(
      exception,
      host.switchToHttp().getResponse<Response>(),
    );
  }

  static respond(exception: unknown, response: Response): void {
    const status = HttpExceptionFilter.statusOf(exception);
    if (status >= 500) {
      HttpExceptionFilter.logger.error(exception);
    }
    const body: ErrorResponseDto = {
      error:
        status >= 500
          ? INTERNAL_ERROR_MESSAGE
          : HttpExceptionFilter.extractMessage(exception),
    };
    response.status(status).json(body);
  }

  static send(response: Response, status: number, message: string): void {
    const body: ErrorResponseDto = { error: message };
    response.status(status).json(body);
  }

  static statusOf(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (HttpExceptionFilter.isExposedClientError(exception)) {
      return exception.status;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private static isExposedClientError(
    exception: unknown,
  ): exception is Error & { status: number } {
    if (!(exception instanceof Error)) {
      return false;
    }
    const { status, expose } = exception as Error & {
      status?: unknown;
      expose?: unknown;
    };
    return (
      expose === true &&
      typeof status === 'number' &&
      status >= 400 &&
      status < 500
    );
  }

  private static extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        return exceptionResponse;
      }
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const { message } = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(message)) {
          return message.join(', ');
        }
        if (typeof message === 'string') {
          return message;
        }
      }
      return exception.message;
    }
    return exception instanceof Error ? exception.message : 'Bad request';
  }
}
