import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { describe, expect, it, vi } from 'vitest';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ShareExpiredException } from '../../common/exceptions/shares/share-expired.exception.js';
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
  it('answers 404 for an unknown tag or folder', () => {
    expect(respondTo(new TagNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Tag not found' },
    });
    expect(respondTo(new FolderNotFoundException()).status).toBe(404);
  });

  it('answers 404 for a missing share', () => {
    expect(respondTo(new ShareNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Share not found' },
    });
  });

  it('answers 410 for an expired or used up share', () => {
    expect(respondTo(new ShareExpiredException())).toEqual({
      status: 410,
      body: { error: 'Share expired' },
    });
  });

  it('answers 400 for a refused Turnstile challenge', () => {
    expect(respondTo(new InvalidTurnstileTokenException()).status).toBe(400);
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
