import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

const STATUS_BY_EXCEPTION: Record<string, number> = {
  ValidationException: HttpStatus.BAD_REQUEST,
  FileNotFoundException: HttpStatus.NOT_FOUND,
  FileInUseException: HttpStatus.CONFLICT,
  FileNotReadyException: HttpStatus.CONFLICT,
  StorageUnavailableException: HttpStatus.SERVICE_UNAVAILABLE,
};

@Catch()
export class FilesExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_EXCEPTION[exception.name];
    if (status === undefined) {
      HttpExceptionFilter.respond(exception, response);
      return;
    }
    HttpExceptionFilter.send(response, status, exception.message);
  }
}
