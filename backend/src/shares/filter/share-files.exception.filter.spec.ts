import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotUploadingException } from '../../common/exceptions/files/file-not-uploading.exception.js';
import { FileTooLargeException } from '../../common/exceptions/files/file-too-large.exception.js';
import { PartLengthMismatchException } from '../../common/exceptions/files/part-length-mismatch.exception.js';
import { PartTooLargeException } from '../../common/exceptions/files/part-too-large.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { UploadIncompleteException } from '../../common/exceptions/files/upload-incomplete.exception.js';
import { ShareNotFoundException } from '../../common/exceptions/shares/share-not-found.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { ShareFilesExceptionFilter } from './share-files.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new ShareFilesExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('ShareFilesExceptionFilter', () => {
  it.each([
    [new ValidationException('size: too small'), 400],
    [new PartLengthMismatchException(), 400],
    [new ShareNotFoundException(), 404],
    [new FileNotFoundException(), 404],
    [new FileNotUploadingException(), 409],
    [new UploadIncompleteException(), 409],
    [new UploadNotFoundException(), 409],
    [new FileTooLargeException(), 413],
    [new TooManyFilesException(), 413],
    [new PartTooLargeException(), 413],
    [new StorageQuotaExceededException(), 413],
    [new StorageUnavailableException(), 503],
  ])('maps %s to its status', (exception, expected) => {
    expect(respondTo(exception)).toEqual({
      status: expected,
      body: { error: exception.message },
    });
  });

  it('answers 500 without the internal message for an unknown error', () => {
    expect(respondTo(new Error('SQL syntax near files'))).toEqual({
      status: 500,
      body: { error: 'Internal server error' },
    });
  });
});
