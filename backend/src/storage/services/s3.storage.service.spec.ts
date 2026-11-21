import { Readable } from 'node:stream';
import type {
  DeleteObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PartTooLargeException } from '../../common/exceptions/files/part-too-large.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
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

  describe('multipart upload on the internal client', () => {
    let send: ReturnType<typeof vi.fn>;
    let storage: S3StorageService;

    beforeEach(() => {
      send = vi.fn();
      storage = new S3StorageService(
        settings,
        { send } as unknown as S3Client,
        s3ClientFor(settings, settings.publicEndpoint),
      );
    });

    function s3Error(name: string, message: string): Error {
      return Object.assign(new Error(message), { name, Code: name });
    }

    it('turns "Bucket quota exceeded" at completion into a 413 exception', async () => {
      send.mockRejectedValue(
        s3Error('XRustfsBucketQuotaExceeded', 'Bucket quota exceeded'),
      );

      await expect(
        storage.completeMultipartUpload('files/k', 'u', [
          { partNumber: 1, size: 5, etag: '"e1"' },
        ]),
      ).rejects.toBeInstanceOf(StorageQuotaExceededException);
    });

    it('turns NoSuchUpload into UploadNotFoundException', async () => {
      send.mockRejectedValue(s3Error('NoSuchUpload', 'upload does not exist'));

      await expect(storage.listParts('files/k', 'u')).rejects.toBeInstanceOf(
        UploadNotFoundException,
      );
    });

    it('turns any other S3 failure into StorageUnavailableException', async () => {
      send.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(storage.getObjectSize('files/k')).rejects.toBeInstanceOf(
        StorageUnavailableException,
      );
    });

    it('deletes an object with DeleteObject on the bucket', async () => {
      send.mockResolvedValue({});

      await expect(storage.deleteObject('files/k')).resolves.toBeUndefined();
      expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({
        Bucket: 'urls',
        Key: 'files/k',
      });
    });

    it('treats an absent object (NoSuchKey) as already deleted', async () => {
      send.mockRejectedValue(s3Error('NoSuchKey', 'not here'));

      await expect(storage.deleteObject('files/k')).resolves.toBeUndefined();
    });

    it.each([
      ['NoSuchBucket', s3Error('NoSuchBucket', 'no bucket')],
      ['AccessDenied', s3Error('AccessDenied', 'denied')],
      ['NotFound without an S3 code', s3Error('NotFound', 'UnknownError')],
      ['a network failure', new Error('connect ECONNREFUSED')],
    ])('turns %s into StorageUnavailableException', async (_label, failure) => {
      send.mockRejectedValue(failure);

      await expect(storage.deleteObject('files/k')).rejects.toBeInstanceOf(
        StorageUnavailableException,
      );
    });

    it('lists every part across pages', async () => {
      send
        .mockResolvedValueOnce({
          Parts: [{ PartNumber: 1, Size: 5, ETag: '"e1"' }],
          IsTruncated: true,
          NextPartNumberMarker: '1',
        })
        .mockResolvedValueOnce({
          Parts: [{ PartNumber: 2, Size: 3, ETag: '"e2"' }],
          IsTruncated: false,
        });

      await expect(storage.listParts('files/k', 'u')).resolves.toEqual([
        { partNumber: 1, size: 5, etag: '"e1"' },
        { partNumber: 2, size: 3, etag: '"e2"' },
      ]);
      const secondPage = send.mock.calls[1][0] as ListPartsCommand;
      expect(secondPage.input.PartNumberMarker).toBe('1');
    });

    it('streams a part with its exact length', async () => {
      send.mockResolvedValue({ ETag: '"e1"' });
      const body = Readable.from([Buffer.from('abc')]);

      await storage.uploadPart('files/k', 'u', 2, body, 3);

      const command = send.mock.calls[0][0] as UploadPartCommand;
      expect(command.input).toMatchObject({
        Bucket: 'urls',
        Key: 'files/k',
        UploadId: 'u',
        PartNumber: 2,
        ContentLength: 3,
      });
      expect(command.input.Body).toBe(body);
    });

    it('rethrows the error of the part stream itself rather than a storage error', async () => {
      const body = new Readable({ read() {} }).on('error', () => undefined);
      const cause = new PartTooLargeException();
      body.destroy(cause);
      send.mockRejectedValue(new Error('socket hang up'));

      await expect(storage.uploadPart('files/k', 'u', 1, body, 3)).rejects.toBe(
        cause,
      );
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
