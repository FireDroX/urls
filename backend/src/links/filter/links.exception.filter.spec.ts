import type { ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { LinkExpiredException } from '../../common/exceptions/links/link-expired.exception.js';
import { LinkNotFoundException } from '../../common/exceptions/links/link-not-found.exception.js';
import { LinksExceptionFilter } from './links.exception.filter.js';

function respondTo(exception: Error): { status: number; body: unknown } {
  const status = vi.fn();
  const json = vi.fn();
  const response = { status, json } as unknown as Response;
  status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new LinksExceptionFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0],
  };
}

describe('LinksExceptionFilter', () => {
  it('answers 404 with a generic message for a missing link', () => {
    expect(respondTo(new LinkNotFoundException())).toEqual({
      status: 404,
      body: { error: 'Link not found' },
    });
  });

  it('answers 410 for an expired link', () => {
    expect(respondTo(new LinkExpiredException())).toEqual({
      status: 410,
      body: { error: 'Link expired' },
    });
  });
});
