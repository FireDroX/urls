import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ShareNotFoundException } from '../../common/exceptions/shares/share-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { SharesExceptionFilter } from './shares.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new SharesExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('SharesExceptionFilter', () => {
  it('answers 404 for a missing share', () => {
    expect(respondTo(new ShareNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Share not found' },
    });
  });

  it('answers 409 for a slug already taken', () => {
    expect(respondTo(new SlugAlreadyTakenException()).status).toBe(409);
  });

  it('answers 400 for invalid input', () => {
    expect(respondTo(new ValidationException('slug: is reserved')).status).toBe(
      400,
    );
  });

  it('answers 500 without the internal message for an unknown error', () => {
    expect(respondTo(new Error('SQL syntax near links'))).toEqual({
      status: 500,
      body: { error: 'Internal server error' },
    });
  });
});
