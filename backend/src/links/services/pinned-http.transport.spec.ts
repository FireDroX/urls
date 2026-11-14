import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PinnedHttpTransport } from './pinned-http.transport.js';

describe('PinnedHttpTransport', () => {
  let server: http.Server;
  let port: number;
  let seen: http.IncomingMessage[];
  let handler: http.RequestListener;
  const transport = new PinnedHttpTransport();

  beforeEach(async () => {
    seen = [];
    handler = (req, res) => {
      seen.push(req);
      res.statusCode = 200;
      res.end();
    };
    server = http.createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const send = (
    method: 'HEAD' | 'GET',
    url = `http://pinned.invalid:${port}/path?q=1`,
    signal = new AbortController().signal,
  ) =>
    transport.send({ url: new URL(url), method, address: '127.0.0.1', signal });

  it('connects to the pinned address without resolving the name', async () => {
    const response = await send('HEAD');

    expect(response.status).toBe(200);
    expect(seen[0].headers.host).toBe(`pinned.invalid:${port}`);
    expect(seen[0].url).toBe('/path?q=1');
    expect(seen[0].method).toBe('HEAD');
  });

  it('sends a generic user agent and no credentials', async () => {
    await send('GET');

    expect(seen[0].method).toBe('GET');
    expect(seen[0].headers['user-agent']).toBe(
      'Mozilla/5.0 (compatible; link-checker)',
    );
    expect(seen[0].headers.cookie).toBeUndefined();
    expect(seen[0].headers.authorization).toBeUndefined();
  });

  it('never forwards credentials found in the url', async () => {
    await send('GET', `http://user:pass@pinned.invalid:${port}/`);

    expect(seen[0].headers.authorization).toBeUndefined();
  });

  it('returns the status and the location header', async () => {
    handler = (_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', '/next');
      res.end();
    };

    expect(await send('HEAD')).toEqual({ status: 302, location: '/next' });
  });

  it('resolves right after the headers without reading the body', async () => {
    handler = (_req, res) => {
      res.writeHead(200);
      res.write('x'.repeat(1024));
    };

    expect((await send('GET')).status).toBe(200);
  });

  it('rejects when the signal is aborted', async () => {
    handler = () => undefined;
    const controller = new AbortController();
    const pending = send('GET', undefined, controller.signal);
    controller.abort();

    await expect(pending).rejects.toThrow();
  });
});
