import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { FileInUseException } from '../../common/exceptions/files/file-in-use.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotReadyException } from '../../common/exceptions/files/file-not-ready.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { FilesExceptionFilter } from './files.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new FilesExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('FilesExceptionFilter', () => {
  it.each([
    [new ValidationException('orphans: invalid'), 400],
    [new FileNotFoundException(), 404],
    [new FileInUseException(), 409],
    [new FileNotReadyException(), 409],
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
