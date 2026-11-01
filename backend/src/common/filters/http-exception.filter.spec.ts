import {
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

function fakeResponse(): {
  response: Response;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  return { response, status, json };
}

describe('HttpExceptionFilter', () => {
  it('keeps the 429 of the throttler', () => {
    const { response, status } = fakeResponse();

    HttpExceptionFilter.respond(new ThrottlerException(), response);

    expect(status).toHaveBeenCalledWith(429);
  });

  it.each([
    [new PayloadTooLargeException(), 413],
    [new NotFoundException(), 404],
    [new UnauthorizedException(), 401],
  ])('keeps the status of %s', (exception, expected) => {
    const { response, status } = fakeResponse();

    HttpExceptionFilter.respond(exception, response);

    expect(status).toHaveBeenCalledWith(expected);
  });

  it('never exposes the message of an unexpected error', () => {
    const { response, status, json } = fakeResponse();

    HttpExceptionFilter.respond(
      new Error("ER_NO_SUCH_TABLE: Table 'urls.links' doesn't exist"),
      response,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('keeps the 4xx of a body-parser error, such as an invalid JSON body', () => {
    const { response, status, json } = fakeResponse();
    const invalidJson = Object.assign(new Error('Unexpected token'), {
      status: 400,
      expose: true,
    });

    HttpExceptionFilter.respond(invalidJson, response);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Unexpected token' });
  });

  it('answers 500 for an error carrying a status it does not expose', () => {
    const hidden = Object.assign(new Error('hidden'), {
      status: 400,
      expose: false,
    });

    expect(HttpExceptionFilter.statusOf(hidden)).toBe(500);
  });
});
