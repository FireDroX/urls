import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { DropExpiredException } from '../../common/exceptions/drops/drop-expired.exception.js';
import { DropLimitExceededException } from '../../common/exceptions/drops/drop-limit-exceeded.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotUploadingException } from '../../common/exceptions/files/file-not-uploading.exception.js';
import { FileTooLargeException } from '../../common/exceptions/files/file-too-large.exception.js';
import { LinkBytesLimitExceededException } from '../../common/exceptions/files/link-bytes-limit-exceeded.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { DropUploadsExceptionFilter } from './drop-uploads.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new DropUploadsExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('DropUploadsExceptionFilter', () => {
  it.each([
    [new ValidationException('size: too small'), 400],
    [new InvalidTurnstileTokenException(), 400],
    [new DropNotFoundException(), 404],
    [new FileNotFoundException(), 404],
    [new FileNotUploadingException(), 409],
    [new DropExpiredException(), 410],
    [new FileTooLargeException(), 413],
    [new DropLimitExceededException(), 413],
    [new StorageUnavailableException(), 503],
  ])('maps %o to %i', (exception, status) => {
    expect(respondTo(exception).status).toBe(status);
  });

  it.each([
    new TooManyFilesException(),
    new LinkBytesLimitExceededException(),
    new StorageQuotaExceededException(),
  ])('never reveals the quota behind %o', (exception) => {
    expect(respondTo(exception)).toEqual({
      status: 413,
      body: { error: 'Upload exceeds the drop limits' },
    });
  });
});
