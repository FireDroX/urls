import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { s3ClientFor, type StorageSettings } from '../storage.config.js';
import { S3StorageService } from './s3.storage.service.js';

const settings: StorageSettings = {
  endpoint: 'http://rustfs:9000',
  publicEndpoint: 'https://cdn.example.org',
  region: 'us-east-1',
  bucket: 'urls',
  accessKeyId: 'urls_app',
  secretAccessKey: 'storage-secret-from-a-vault',
};

function service(): S3StorageService {
  return new S3StorageService(
    settings,
    s3ClientFor(settings, settings.endpoint),
    s3ClientFor(settings, settings.publicEndpoint),
  );
}

describe('S3StorageService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signs download URLs with the public host and forces an attachment', async () => {
    const url = new URL(
      await service().getPresignedDownloadUrl(
        'd/abc/1',
        'rapport final.pdf',
        60,
      ),
    );

    expect(url.origin).toBe('https://cdn.example.org');
    expect(url.pathname).toBe('/urls/d/abc/1');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      `attachment; filename="rapport final.pdf"; filename*=UTF-8''rapport%20final.pdf`,
    );
  });

  it('reads usage and quota from the signed RustFS quota-stats endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          bucket: 'urls',
          quota_limit: 80_530_636_800,
          current_usage: 1024,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(service().getUsage()).resolves.toEqual({
      usedBytes: 1024,
      quotaBytes: 80_530_636_800,
    });
    const [calledUrl, init] = fetchMock.mock.calls[0] as [
      URL,
      { headers: Record<string, string> },
    ];
    expect(calledUrl.href).toBe(
      'http://rustfs:9000/rustfs/admin/v3/quota-stats/urls',
    );
    expect(init.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=urls_app\//,
    );
  });

  it('reports null when RustFS has no usage figure yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ quota_limit: null, current_usage: null }),
          ),
        ),
    );

    await expect(service().getUsage()).resolves.toEqual({
      usedBytes: null,
      quotaBytes: null,
    });
  });

  it('turns a storage failure into StorageUnavailableException', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('denied', { status: 403 })),
    );

    await expect(service().getUsage()).rejects.toBeInstanceOf(
      StorageUnavailableException,
    );
  });
});
