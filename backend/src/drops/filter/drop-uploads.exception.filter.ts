import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DropLimitExceededException } from '../../common/exceptions/drops/drop-limit-exceeded.exception.js';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

const STATUS_BY_EXCEPTION: Record<string, number> = {
  ValidationException: HttpStatus.BAD_REQUEST,
  PartLengthMismatchException: HttpStatus.BAD_REQUEST,
  InvalidTurnstileTokenException: HttpStatus.BAD_REQUEST,
  DropNotFoundException: HttpStatus.NOT_FOUND,
  FileNotFoundException: HttpStatus.NOT_FOUND,
  FileNotUploadingException: HttpStatus.CONFLICT,
  UploadIncompleteException: HttpStatus.CONFLICT,
  UploadNotFoundException: HttpStatus.CONFLICT,
  DropExpiredException: HttpStatus.GONE,
  FileTooLargeException: HttpStatus.PAYLOAD_TOO_LARGE,
  PartTooLargeException: HttpStatus.PAYLOAD_TOO_LARGE,
  DropLimitExceededException: HttpStatus.PAYLOAD_TOO_LARGE,
  StorageUnavailableException: HttpStatus.SERVICE_UNAVAILABLE,
};

const QUOTA_EXCEPTIONS = [
  'TooManyFilesException',
  'LinkBytesLimitExceededException',
  'StorageQuotaExceededException',
];

@Catch()
export class DropUploadsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (QUOTA_EXCEPTIONS.includes(exception.name)) {
      HttpExceptionFilter.send(
        response,
        HttpStatus.PAYLOAD_TOO_LARGE,
        new DropLimitExceededException().message,
      );
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
