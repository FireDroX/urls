import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import {
  LINK_CHECK_MAX_REDIRECTS,
  LINK_CHECK_TIMEOUT_MS,
} from '../../common/variables.global.js';
import { DestinationProbe } from './destination-probe.service.js';

const PUBLIC_IP = '93.184.216.34';

interface SentRequest {
  url: URL;
  method: string;
  address: string;
}

function reply(status: number, location: string | null = null) {
  return { status, location };
}

function delayedReply(delayMs: number, response: ReturnType<typeof reply>) {
  return ({ signal }: { signal: AbortSignal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(response), delayMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      });
    });
}

describe('DestinationProbe', () => {
  let transport: { resolve: Mock; send: Mock };
  let probe: DestinationProbe;

  const sentRequests = () =>
    transport.send.mock.calls.map((call) => call[0] as SentRequest);

  beforeEach(() => {
    transport = {
      resolve: vi.fn().mockResolvedValue([PUBLIC_IP]),
      send: vi.fn().mockResolvedValue(reply(200)),
    };
    probe = new DestinationProbe(transport);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a 200 as ok', async () => {
    expect(await probe.check('https://example.com/')).toEqual({
      outcome: 'ok',
      statusCode: 200,
      errorKind: null,
    });
  });

  it('reports a 3xx without location as ok', async () => {
    transport.send.mockResolvedValue(reply(304));

    expect((await probe.check('https://example.com/')).outcome).toBe('ok');
  });

  it.each([404, 500])(
    'reports %i as broken with its status',
    async (status) => {
      transport.send.mockResolvedValue(reply(status));

      expect(await probe.check('https://example.com/')).toEqual({
        outcome: 'broken',
        statusCode: status,
        errorKind: null,
      });
    },
  );

  it('reports an out of range status as a connection error', async () => {
    transport.send.mockResolvedValue(reply(101));

    expect(await probe.check('https://example.com/')).toEqual({
      outcome: 'broken',
      statusCode: null,
      errorKind: 'connection',
    });
  });

  it.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'http://2130706433/',
    'http://[::ffff:7f00:1]/',
  ])('skips the private literal %s without sending', async (destination) => {
    expect(await probe.check(destination)).toEqual({
      outcome: 'skipped',
      statusCode: null,
      errorKind: null,
    });
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('skips a name resolving to a private address among public ones', async () => {
    transport.resolve.mockResolvedValue([PUBLIC_IP, '10.0.0.5']);

    expect((await probe.check('https://example.com/')).outcome).toBe('skipped');
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('skips an unsupported destination protocol', async () => {
    expect((await probe.check('ftp://example.com/')).outcome).toBe('skipped');
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('pins the request to the first resolved address, resolving once per hop', async () => {
    transport.resolve.mockResolvedValue([PUBLIC_IP, '8.8.8.8']);

    await probe.check('https://example.com/a');

    expect(transport.resolve).toHaveBeenCalledTimes(1);
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(transport.send.mock.calls[0][0]).toMatchObject({
      address: PUBLIC_IP,
      method: 'HEAD',
    });
  });

  it('follows redirects and resolves relative locations', async () => {
    transport.send
      .mockResolvedValueOnce(reply(301, '/b'))
      .mockResolvedValueOnce(reply(302, 'https://other.example/c'))
      .mockResolvedValueOnce(reply(200));

    const result = await probe.check('https://example.com/a');

    expect(result.outcome).toBe('ok');
    const urls = sentRequests().map((request) => request.url.href);
    expect(urls).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://other.example/c',
    ]);
    expect(transport.resolve).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['a literal private address', 'http://192.168.1.1/admin', undefined],
    [
      'a name resolving to a private address',
      'http://internal.example/',
      '10.1.1.1',
    ],
  ])(
    'skips a redirect to %s after the first hop',
    async (_label, target, resolved) => {
      transport.resolve.mockImplementation((host: string) =>
        Promise.resolve([host === 'internal.example' ? resolved : PUBLIC_IP]),
      );
      transport.send.mockResolvedValueOnce(reply(302, target));

      expect((await probe.check('https://example.com/')).outcome).toBe(
        'skipped',
      );
      expect(transport.send).toHaveBeenCalledTimes(1);
    },
  );

  it('gives up after too many redirects', async () => {
    transport.send.mockResolvedValue(reply(302, '/loop'));

    expect(await probe.check('https://example.com/')).toEqual({
      outcome: 'broken',
      statusCode: null,
      errorKind: 'too_many_redirects',
    });
    expect(transport.send).toHaveBeenCalledTimes(LINK_CHECK_MAX_REDIRECTS + 1);
  });

  it.each(['ftp://example.com/file', 'javascript:alert(1)'])(
    'rejects a redirect to %s',
    async (location) => {
      transport.send.mockResolvedValueOnce(reply(302, location));

      expect(await probe.check('https://example.com/')).toEqual({
        outcome: 'broken',
        statusCode: null,
        errorKind: 'invalid_redirect',
      });
    },
  );

  it.each([405, 501])('falls back to GET on HEAD %i', async (status) => {
    transport.send
      .mockResolvedValueOnce(reply(status))
      .mockResolvedValueOnce(reply(200));

    const result = await probe.check('https://example.com/');

    expect(result).toMatchObject({ outcome: 'ok', statusCode: 200 });
    const [head, get] = sentRequests();
    expect([head.method, get.method]).toEqual(['HEAD', 'GET']);
    expect(get.address).toBe(head.address);
  });

  it('reports a DNS failure', async () => {
    transport.resolve.mockRejectedValue(new Error('ENOTFOUND'));

    expect(await probe.check('https://nowhere.example/')).toMatchObject({
      outcome: 'broken',
      errorKind: 'dns',
    });
  });

  it('reports an empty resolution as a DNS failure', async () => {
    transport.resolve.mockResolvedValue([]);

    expect((await probe.check('https://example.com/')).errorKind).toBe('dns');
  });

  it('reports a refused connection', async () => {
    transport.send.mockRejectedValue(
      Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
    );

    expect((await probe.check('https://example.com/')).errorKind).toBe(
      'connection',
    );
  });

  it.each([
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ])('reports the certificate error %s as tls', async (code) => {
    transport.send.mockRejectedValue(Object.assign(new Error('x'), { code }));

    expect((await probe.check('https://example.com/')).errorKind).toBe('tls');
  });

  it('reports a timeout and aborts the request', async () => {
    vi.useFakeTimers();
    transport.send.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = probe.check('https://example.com/');
    await vi.advanceTimersByTimeAsync(LINK_CHECK_TIMEOUT_MS);

    expect(await pending).toEqual({
      outcome: 'broken',
      statusCode: null,
      errorKind: 'timeout',
    });
  });

  it('shares the timeout budget across hops', async () => {
    vi.useFakeTimers();
    const hopDelay = Math.ceil(LINK_CHECK_TIMEOUT_MS * 0.6);
    transport.send
      .mockImplementationOnce(delayedReply(hopDelay, reply(302, '/b')))
      .mockImplementationOnce(delayedReply(hopDelay, reply(200)));

    const pending = probe.check('https://example.com/a');
    await vi.advanceTimersByTimeAsync(LINK_CHECK_TIMEOUT_MS);

    expect(await pending).toEqual({
      outcome: 'broken',
      statusCode: null,
      errorKind: 'timeout',
    });
    expect(transport.send).toHaveBeenCalledTimes(2);
  });

  it('times out while resolving the name', async () => {
    vi.useFakeTimers();
    transport.resolve.mockReturnValue(new Promise(() => undefined));

    const pending = probe.check('https://example.com/');
    await vi.advanceTimersByTimeAsync(LINK_CHECK_TIMEOUT_MS);

    expect((await pending).errorKind).toBe('timeout');
  });

  it('clears its timer once the check is done', async () => {
    vi.useFakeTimers();

    await probe.check('https://example.com/');

    expect(vi.getTimerCount()).toBe(0);
  });
});
