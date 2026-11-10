import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { ShareExpiredException } from '../../common/exceptions/shares/share-expired.exception.js';
import { ShareNotFoundException } from '../../common/exceptions/shares/share-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  LINK_SLUG_MAX_LENGTH,
  SHARE_DOWNLOAD_URL_TTL_SECONDS,
  TURNSTILE_TOKEN_MAX_LENGTH,
} from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import type { EventsService } from '../../events/services/events.service.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { TurnstileService } from '../../security/services/turnstile.service.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { ShareRepository } from '../persistence/share.repository.js';
import { PublicSharesService } from './public-shares.service.js';

const VISITOR: Visitor = {
  ip: '203.0.113.9',
  referer: undefined,
  userAgent: 'Mozilla/5.0',
  country: 'FR',
};
const PRESIGNED_URL = 'https://cdn.example/urls/shares/key?X-Amz-Signature=abc';

function buildShare(overrides: Partial<Link> = {}): Link {
  return {
    id: 'share-uuid',
    publicId: 'share123',
    type: 'share',
    destination: null,
    expiresAt: null,
    maxDownloads: null,
    downloadCount: 0,
    title: null,
    maxTotalBytes: null,
    maxFiles: null,
    disabled: false,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function buildFile(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: 'file-uuid',
    publicId: 'file1234',
    linkId: 'share-uuid',
    s3Key: 'shares/opaque-key',
    name: 'Vidéo de l’été.mp4',
    size: 150_000_000,
    mime: 'video/mp4',
    sha256: 'a'.repeat(64),
    status: 'ready',
    uploadId: null,
    uploaderName: null,
    uploadTokenHash: null,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    completedAt: new Date('2026-11-01T00:01:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('PublicSharesService', () => {
  let repository: {
    findByPublicId: ReturnType<typeof vi.fn>;
    incrementDownloadCount: ReturnType<typeof vi.fn>;
  };
  let files: { listForLink: ReturnType<typeof vi.fn> };
  let events: {
    recordView: ReturnType<typeof vi.fn>;
    recordDownload: ReturnType<typeof vi.fn>;
  };
  let turnstile: { verify: ReturnType<typeof vi.fn> };
  let storage: { getPresignedDownloadUrl: ReturnType<typeof vi.fn> };
  let service: PublicSharesService;

  beforeEach(() => {
    repository = {
      findByPublicId: vi.fn().mockResolvedValue(buildShare()),
      incrementDownloadCount: vi.fn().mockResolvedValue(true),
    };
    files = { listForLink: vi.fn().mockResolvedValue([buildFile()]) };
    events = {
      recordView: vi.fn().mockResolvedValue(undefined),
      recordDownload: vi.fn().mockResolvedValue(undefined),
    };
    turnstile = { verify: vi.fn().mockResolvedValue(true) };
    storage = {
      getPresignedDownloadUrl: vi.fn().mockResolvedValue(PRESIGNED_URL),
    };
    service = new PublicSharesService(
      repository as unknown as ShareRepository,
      files as unknown as FilesService,
      events as unknown as EventsService,
      turnstile as unknown as TurnstileService,
      storage as unknown as StorageService,
    );
  });

  describe('view', () => {
    it('returns only the ready files with their count and total size', async () => {
      const ready = [
        buildFile(),
        buildFile({ publicId: 'file5678', size: 50 }),
      ];
      files.listForLink.mockResolvedValue([
        ...ready,
        buildFile({ publicId: 'upload01', status: 'uploading' }),
        buildFile({ publicId: 'reject01', status: 'rejected' }),
      ]);

      const result = await service.view('share123', VISITOR);

      expect(result).toEqual({
        share: buildShare(),
        files: ready,
        fileCount: 2,
        totalSize: 150_000_050,
      });
    });

    it('records a view without waiting for it', async () => {
      events.recordView.mockReturnValue(new Promise(() => undefined));

      await expect(service.view('share123', VISITOR)).resolves.toBeDefined();
      expect(events.recordView).toHaveBeenCalledWith('share-uuid', VISITOR);
    });

    it.each([
      [
        'an unknown or deleted share',
        () => repository.findByPublicId.mockResolvedValue(null),
      ],
      [
        'a disabled share',
        () =>
          repository.findByPublicId.mockResolvedValue(
            buildShare({ disabled: true }),
          ),
      ],
      ['a share without files', () => files.listForLink.mockResolvedValue([])],
      [
        'a share without ready files',
        () =>
          files.listForLink.mockResolvedValue([
            buildFile({ status: 'uploading' }),
            buildFile({ status: 'verifying' }),
          ]),
      ],
    ])('answers the same not found for %s', async (_label, arrange) => {
      arrange();

      await expect(service.view('share123', VISITOR)).rejects.toEqual(
        new ShareNotFoundException(),
      );
      expect(events.recordView).not.toHaveBeenCalled();
    });

    it.each(['bad id!', 'a'.repeat(LINK_SLUG_MAX_LENGTH + 1), '../api'])(
      'rejects the malformed id %s before querying the database',
      async (id) => {
        await expect(service.view(id, VISITOR)).rejects.toEqual(
          new ShareNotFoundException(),
        );
        expect(repository.findByPublicId).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['past its expiration date', { expiresAt: new Date(Date.now() - 1000) }],
      ['at its download limit', { maxDownloads: 3, downloadCount: 3 }],
      ['beyond its download limit', { maxDownloads: 2, downloadCount: 5 }],
    ])('answers expired for a share %s', async (_label, overrides) => {
      repository.findByPublicId.mockResolvedValue(buildShare(overrides));

      await expect(service.view('share123', VISITOR)).rejects.toBeInstanceOf(
        ShareExpiredException,
      );
      expect(events.recordView).not.toHaveBeenCalled();
    });

    it('serves a share below its limit and before its expiration', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildShare({
          maxDownloads: 3,
          downloadCount: 2,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      );

      await expect(service.view('share123', VISITOR)).resolves.toMatchObject({
        fileCount: 1,
      });
    });
  });

  describe('download', () => {
    const BODY = { turnstileToken: 'token' };

    it('verifies Turnstile with the client IP, counts the download and signs a short URL', async () => {
      const url = await service.download('share123', 'file1234', BODY, VISITOR);

      expect(turnstile.verify).toHaveBeenCalledWith('token', VISITOR.ip);
      expect(repository.incrementDownloadCount).toHaveBeenCalledWith(
        'share-uuid',
        expect.any(Date),
      );
      expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
        'shares/opaque-key',
        'Vidéo de l’été.mp4',
        SHARE_DOWNLOAD_URL_TTL_SECONDS,
      );
      expect(events.recordDownload).toHaveBeenCalledWith('share-uuid', VISITOR);
      expect(url).toBe(PRESIGNED_URL);
    });

    it('rejects a refused Turnstile challenge before any lookup or URL', async () => {
      turnstile.verify.mockResolvedValue(false);

      await expect(
        service.download('share123', 'file1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(InvalidTurnstileTokenException);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
      expect(repository.incrementDownloadCount).not.toHaveBeenCalled();
      expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled();
      expect(events.recordDownload).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown field', { turnstileToken: 'token', extra: true }],
      [
        'a token too long',
        { turnstileToken: 't'.repeat(TURNSTILE_TOKEN_MAX_LENGTH + 1) },
      ],
      ['a non-object body', 'token'],
    ])('rejects %s with ValidationException', async (_label, body) => {
      await expect(
        service.download('share123', 'file1234', body, VISITOR),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(turnstile.verify).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown file', 'missing1', [buildFile()]],
      [
        'a file not ready yet',
        'upload01',
        [buildFile(), buildFile({ publicId: 'upload01', status: 'uploading' })],
      ],
    ])('answers not found for %s', async (_label, fileId, fileList) => {
      files.listForLink.mockResolvedValue(fileList);

      await expect(
        service.download('share123', fileId, BODY, VISITOR),
      ).rejects.toEqual(new ShareNotFoundException());
      expect(repository.incrementDownloadCount).not.toHaveBeenCalled();
    });

    it('answers not found for a disabled share', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildShare({ disabled: true }),
      );

      await expect(
        service.download('share123', 'file1234', BODY, VISITOR),
      ).rejects.toEqual(new ShareNotFoundException());
    });

    it('answers expired without counting when the share is already used up', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildShare({ maxDownloads: 1, downloadCount: 1 }),
      );

      await expect(
        service.download('share123', 'file1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(ShareExpiredException);
      expect(repository.incrementDownloadCount).not.toHaveBeenCalled();
    });

    it('lets only one of two concurrent last downloads through', async () => {
      repository.findByPublicId.mockResolvedValue(
        buildShare({ maxDownloads: 1, downloadCount: 0 }),
      );
      repository.incrementDownloadCount
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const results = await Promise.allSettled([
        service.download('share123', 'file1234', BODY, VISITOR),
        service.download('share123', 'file1234', BODY, VISITOR),
      ]);

      expect(results[0]).toEqual({ status: 'fulfilled', value: PRESIGNED_URL });
      expect(results[1]).toMatchObject({ status: 'rejected' });
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(
        ShareExpiredException,
      );
      expect(storage.getPresignedDownloadUrl).toHaveBeenCalledTimes(1);
      expect(events.recordDownload).toHaveBeenCalledTimes(1);
    });
  });
});
