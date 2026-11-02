import type { Request } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { describeVisitor } from './visitor.js';

function request(headers: Record<string, string | string[]>): Request {
  return { headers, ip: '10.0.0.2' } as unknown as Request;
}

describe('describeVisitor', () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADER;
  });

  it('reads the client ip, referer, user agent and Cloudflare country', () => {
    process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';

    expect(
      describeVisitor(
        request({
          'cf-connecting-ip': '203.0.113.9',
          referer: 'https://news.example/post',
          'user-agent': 'Mozilla/5.0',
          'cf-ipcountry': 'FR',
        }),
      ),
    ).toEqual({
      ip: '203.0.113.9',
      referer: 'https://news.example/post',
      userAgent: 'Mozilla/5.0',
      country: 'FR',
    });
  });

  it('leaves missing headers undefined', () => {
    expect(describeVisitor(request({}))).toEqual({
      ip: '10.0.0.2',
      referer: undefined,
      userAgent: undefined,
      country: undefined,
    });
  });

  it('keeps the first value of a repeated header', () => {
    expect(
      describeVisitor(request({ 'cf-ipcountry': ['DE', 'FR'] })).country,
    ).toBe('DE');
  });
});
