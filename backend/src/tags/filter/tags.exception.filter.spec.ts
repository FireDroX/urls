import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { TagNameAlreadyTakenException } from '../../common/exceptions/tags/tag-name-already-taken.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { TagPublicIdTakenException } from '../../common/exceptions/tags/tag-public-id-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { TagsExceptionFilter } from './tags.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new TagsExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('TagsExceptionFilter', () => {
  it('answers 404 for an unknown tag', () => {
    expect(respondTo(new TagNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Tag not found' },
    });
  });

  it('answers 409 for a name already taken', () => {
    expect(respondTo(new TagNameAlreadyTakenException())).toEqual({
      status: 409,
      body: { error: 'Tag name already taken' },
    });
  });

  it('answers 409 when the generated public id stays taken', () => {
    expect(respondTo(new TagPublicIdTakenException()).status).toBe(409);
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
