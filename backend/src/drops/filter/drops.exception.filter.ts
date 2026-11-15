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
  DropNotFoundException: HttpStatus.NOT_FOUND,
  DropExpiredException: HttpStatus.GONE,
  FileNotFoundException: HttpStatus.NOT_FOUND,
  FileNotReadyException: HttpStatus.CONFLICT,
  TagNotFoundException: HttpStatus.NOT_FOUND,
  FolderNotFoundException: HttpStatus.NOT_FOUND,
  SlugAlreadyTakenException: HttpStatus.CONFLICT,
  StorageUnavailableException: HttpStatus.SERVICE_UNAVAILABLE,
};

@Catch()
export class DropsExceptionFilter implements ExceptionFilter {
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
