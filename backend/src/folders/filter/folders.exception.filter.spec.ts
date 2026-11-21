import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { FolderNameAlreadyTakenException } from '../../common/exceptions/folders/folder-name-already-taken.exception.js';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { FolderPublicIdTakenException } from '../../common/exceptions/folders/folder-public-id-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { FoldersExceptionFilter } from './folders.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new FoldersExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('FoldersExceptionFilter', () => {
  it('answers 404 for an unknown folder', () => {
    expect(respondTo(new FolderNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Folder not found' },
    });
  });

  it('answers 409 for a name already taken', () => {
    expect(respondTo(new FolderNameAlreadyTakenException())).toEqual({
      status: 409,
      body: { error: 'Folder name already taken' },
    });
  });

  it('answers 409 when the generated public id stays taken', () => {
    expect(respondTo(new FolderPublicIdTakenException()).status).toBe(409);
  });

  it('answers 400 for an invalid body', () => {
    expect(respondTo(new ValidationException('bad')).status).toBe(400);
  });

  it('answers 500 without leaking an unknown error', () => {
    expect(respondTo(new Error('SQL exploded'))).toEqual({
      status: 500,
      body: { error: 'Internal server error' },
    });
  });
});
