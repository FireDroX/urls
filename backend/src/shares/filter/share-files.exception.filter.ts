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
  PartLengthMismatchException: HttpStatus.BAD_REQUEST,
  ShareNotFoundException: HttpStatus.NOT_FOUND,
  FileNotFoundException: HttpStatus.NOT_FOUND,
  FileNotUploadingException: HttpStatus.CONFLICT,
  UploadIncompleteException: HttpStatus.CONFLICT,
  UploadNotFoundException: HttpStatus.CONFLICT,
  FileTooLargeException: HttpStatus.PAYLOAD_TOO_LARGE,
  TooManyFilesException: HttpStatus.PAYLOAD_TOO_LARGE,
  LinkBytesLimitExceededException: HttpStatus.PAYLOAD_TOO_LARGE,
  PartTooLargeException: HttpStatus.PAYLOAD_TOO_LARGE,
  StorageQuotaExceededException: HttpStatus.PAYLOAD_TOO_LARGE,
  StorageUnavailableException: HttpStatus.SERVICE_UNAVAILABLE,
};

@Catch()
export class ShareFilesExceptionFilter implements ExceptionFilter {
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
