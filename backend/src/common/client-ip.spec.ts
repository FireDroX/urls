import type { Request } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveClientIp } from './client-ip.js';

function request(headers: Record<string, string>, ip = '10.0.0.2'): Request {
  return { headers, ip } as unknown as Request;
}

describe('resolveClientIp', () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADER;
  });

  it('uses the Express-resolved ip when no client IP header is configured', () => {
    expect(
      resolveClientIp(request({ 'cf-connecting-ip': '203.0.113.9' })),
    ).toBe('10.0.0.2');
  });

  it('reads the configured header, case-insensitively', () => {
    process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP';

    expect(
      resolveClientIp(
        request({
          'cf-connecting-ip': '203.0.113.9',
          'x-forwarded-for': '1.2.3.4',
        }),
      ),
    ).toBe('203.0.113.9');
  });

  it('falls back to the Express-resolved ip when the header is missing', () => {
    process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';

    expect(resolveClientIp(request({ 'x-forwarded-for': '1.2.3.4' }))).toBe(
      '10.0.0.2',
    );
  });
});
