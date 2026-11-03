import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { parsesAsJson } from './json-body.js';

function request(url: string, contentType?: string): IncomingMessage {
  return {
    url,
    headers: contentType ? { 'content-type': contentType } : {},
  } as IncomingMessage;
}

describe('parsesAsJson', () => {
  it('parses JSON bodies of the API', () => {
    expect(parsesAsJson(request('/api/shares', 'application/json'))).toBe(true);
    expect(
      parsesAsJson(
        request('/api/shares/abc/files', 'application/json; charset=utf-8'),
      ),
    ).toBe(true);
  });

  it('ignores other content types', () => {
    expect(parsesAsJson(request('/api/shares', 'text/plain'))).toBe(false);
    expect(parsesAsJson(request('/api/shares'))).toBe(false);
  });

  it('never parses a file part, whatever its content type', () => {
    expect(
      parsesAsJson(
        request('/api/shares/abc/files/f1/parts/3', 'application/json'),
      ),
    ).toBe(false);
    expect(
      parsesAsJson(
        request('/api/shares/abc/files/f1/parts/3?x=1', 'application/json'),
      ),
    ).toBe(false);
  });

  it('still parses the complete call next to the parts', () => {
    expect(
      parsesAsJson(
        request('/api/shares/abc/files/f1/complete', 'application/json'),
      ),
    ).toBe(true);
  });
});
