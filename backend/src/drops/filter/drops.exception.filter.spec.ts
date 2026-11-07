import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { DropsExceptionFilter } from './drops.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new DropsExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('DropsExceptionFilter', () => {
  it('answers 404 for a missing drop', () => {
    expect(respondTo(new DropNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Drop not found' },
    });
  });

  it('answers 409 for a taken slug', () => {
    expect(respondTo(new SlugAlreadyTakenException()).status).toBe(409);
  });

  it('answers 400 for invalid input', () => {
    expect(respondTo(new ValidationException('invalid')).status).toBe(400);
  });

  it('answers 500 without leaking an unknown error', () => {
    expect(respondTo(new Error('SQL exploded'))).toEqual({
      status: 500,
      body: { error: 'Internal server error' },
    });
  });
});
