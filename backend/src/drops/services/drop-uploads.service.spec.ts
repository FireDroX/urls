import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { InvalidTurnstileTokenException } from '../../common/exceptions/auth/invalid-turnstile-token.exception.js';
import { DropExpiredException } from '../../common/exceptions/drops/drop-expired.exception.js';
import { DropLimitExceededException } from '../../common/exceptions/drops/drop-limit-exceeded.exception.js';
import { DropNotFoundException } from '../../common/exceptions/drops/drop-not-found.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { LinkBytesLimitExceededException } from '../../common/exceptions/files/link-bytes-limit-exceeded.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { DROP_UPLOADER_NAME_MAX_LENGTH } from '../../common/variables.global.js';
import type { Visitor } from '../../common/visitor.js';
import type { EventsService } from '../../events/services/events.service.js';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type { FileUploadsService } from '../../files/services/file-uploads.service.js';
import type { FilesService } from '../../files/services/files.service.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { TurnstileService } from '../../security/services/turnstile.service.js';
import type { DropRepository } from '../persistence/drop.repository.js';
import { DropUploadsService } from './drop-uploads.service.js';

const VISITOR: Visitor = {
  ip: '203.0.113.9',
  referer: undefined,
  userAgent: 'Mozilla/5.0',
  country: 'FR',
};
const SHA256 = 'ab'.repeat(32);
const TOKEN = 'T'.repeat(43);
const BODY = {
  name: 'photo.jpg',
  size: 100,
  sha256: SHA256,
  turnstileToken: 'cf-token',
};

function buildDrop(overrides: Partial<Link> = {}): Link {
  return {
    id: 'drop-uuid',
    publicId: 'drop1234',
    type: 'drop',
    expiresAt: null,
    maxFiles: 5,
    maxTotalBytes: 1000,
    disabled: false,
    deletedAt: null,
    ...overrides,
  } as Link;
}

const file = {
  id: 'file-uuid',
  publicId: 'file1234',
  name: 'photo.jpg',
  size: 100,
  uploaderName: 'Alice',
} as StoredFile;

describe('DropUploadsService', () => {
  let repository: { findByPublicId: ReturnType<typeof vi.fn> };
  let files: { summarizeCountedLinks: ReturnType<typeof vi.fn> };
  let uploads: {
    open: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    listParts: ReturnType<typeof vi.fn>;
    uploadPart: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let turnstile: { verify: ReturnType<typeof vi.fn> };
  let events: { recordUpload: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: DropUploadsService;

  beforeEach(() => {
    repository = { findByPublicId: vi.fn().mockResolvedValue(buildDrop()) };
    files = {
      summarizeCountedLinks: vi.fn().mockResolvedValue(new Map()),
    };
    uploads = {
      open: vi.fn().mockResolvedValue({ file, partSize: 10, partCount: 10 }),
      status: vi.fn().mockResolvedValue(file),
      listParts: vi.fn().mockResolvedValue({}),
      uploadPart: vi.fn().mockResolvedValue({ partNumber: 1, size: 10 }),
      complete: vi.fn().mockResolvedValue(file),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    turnstile = { verify: vi.fn().mockResolvedValue(true) };
    events = { recordUpload: vi.fn().mockResolvedValue(undefined) };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new DropUploadsService(
      repository as unknown as DropRepository,
      files as unknown as FilesService,
      uploads as unknown as FileUploadsService,
      turnstile as unknown as TurnstileService,
      events as unknown as EventsService,
      audit as unknown as AuditLogService,
    );
  });

  describe('announce', () => {
    it('verifies Turnstile with the real IP before reading anything', async () => {
      turnstile.verify.mockResolvedValue(false);

      await expect(
        service.announce('drop1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(InvalidTurnstileTokenException);

      expect(turnstile.verify).toHaveBeenCalledWith('cf-token', VISITOR.ip);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
      expect(files.summarizeCountedLinks).not.toHaveBeenCalled();
      expect(uploads.open).not.toHaveBeenCalled();
    });

    it('refuses an invalid body before Turnstile', async () => {
      await expect(
        service.announce('drop1234', { ...BODY, extra: 1 }, VISITOR),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(turnstile.verify).not.toHaveBeenCalled();
    });

    it('opens the upload with a token whose hash only is kept', async () => {
      const started = await service.announce(
        'drop1234',
        { ...BODY, uploaderName: '  Alice ' },
        VISITOR,
      );

      expect(started.uploadToken).toHaveLength(43);
      const [, upload, origin] = uploads.open.mock.calls[0] as [
        Link,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(upload).toEqual({ name: 'photo.jpg', size: 100, sha256: SHA256 });
      expect(origin).toMatchObject({
        userId: null,
        uploaderName: 'Alice',
        auditMetadata: { dropId: 'drop1234', uploaderName: 'Alice' },
      });
      expect(origin.uploadTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(origin)).not.toContain(started.uploadToken);
    });

    it('stores a blank uploader name as null', async () => {
      await service.announce(
        'drop1234',
        { ...BODY, uploaderName: '   ' },
        VISITOR,
      );

      expect(uploads.open.mock.calls[0][2]).toMatchObject({
        uploaderName: null,
      });
    });

    it.each([
      'x'.repeat(DROP_UPLOADER_NAME_MAX_LENGTH + 1),
      'Al\u0007ice',
      'Al​ice',
    ])('refuses the uploader name %j', async (uploaderName) => {
      await expect(
        service.announce('drop1234', { ...BODY, uploaderName }, VISITOR),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it.each([
      ['unknown', null],
      ['disabled', buildDrop({ disabled: true })],
    ])('answers 404 for a %s drop', async (_label, drop) => {
      repository.findByPublicId.mockResolvedValue(drop);

      await expect(
        service.announce('drop1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(DropNotFoundException);
      expect(uploads.open).not.toHaveBeenCalled();
    });

    it('answers 404 for a malformed id without reading', async () => {
      await expect(
        service.announce('../x', BODY, VISITOR),
      ).rejects.toBeInstanceOf(DropNotFoundException);
      expect(repository.findByPublicId).not.toHaveBeenCalled();
    });

    it.each([
      [
        'expired',
        buildDrop({ expiresAt: new Date('2020-01-01T00:00:00Z') }),
        0,
      ],
      ['full by count', buildDrop(), 5],
    ])('answers 410 for a %s drop', async (_label, drop, fileCount) => {
      repository.findByPublicId.mockResolvedValue(drop);
      files.summarizeCountedLinks.mockResolvedValue(
        new Map([[drop.id, { fileCount, totalSize: 0 }]]),
      );

      await expect(
        service.announce('drop1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(DropExpiredException);
      expect(uploads.open).not.toHaveBeenCalled();
    });

    it.each([
      new TooManyFilesException(),
      new LinkBytesLimitExceededException(),
      new StorageQuotaExceededException(),
    ])('hides %o behind the single drop limit error', async (error) => {
      uploads.open.mockRejectedValue(error);

      await expect(
        service.announce('drop1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(DropLimitExceededException);
    });

    it('lets the under-lock re-check errors through', async () => {
      uploads.open.mockRejectedValue(new DropExpiredException());

      await expect(
        service.announce('drop1234', BODY, VISITOR),
      ).rejects.toBeInstanceOf(DropExpiredException);
    });
  });

  describe('after the announce', () => {
    const calls: [string, () => Promise<unknown>][] = [
      ['status', () => service.status('drop1234', 'file1234', TOKEN)],
      ['listParts', () => service.listParts('drop1234', 'file1234', TOKEN)],
      [
        'uploadPart',
        () =>
          service.uploadPart('drop1234', 'file1234', '1', {} as never, TOKEN),
      ],
      [
        'complete',
        () => service.complete('drop1234', 'file1234', TOKEN, VISITOR),
      ],
      ['remove', () => service.remove('drop1234', 'file1234', TOKEN)],
    ];

    it.each(calls)(
      '%s answers 404 once the drop is disabled, without touching the file',
      async (_name, call) => {
        repository.findByPublicId.mockResolvedValue(
          buildDrop({ disabled: true }),
        );

        await expect(call()).rejects.toBeInstanceOf(DropNotFoundException);
        for (const method of Object.values(uploads)) {
          expect(method).not.toHaveBeenCalled();
        }
      },
    );

    it.each(calls)('%s answers 404 for a missing drop', async (_name, call) => {
      repository.findByPublicId.mockResolvedValue(null);

      await expect(call()).rejects.toBeInstanceOf(DropNotFoundException);
    });

    it.each(calls)(
      '%s keeps going on an expired and full drop',
      async (_name, call) => {
        repository.findByPublicId.mockResolvedValue(
          buildDrop({ expiresAt: new Date('2020-01-01T00:00:00Z') }),
        );
        files.summarizeCountedLinks.mockResolvedValue(
          new Map([['drop-uuid', { fileCount: 5, totalSize: 1000 }]]),
        );

        await expect(call()).resolves.not.toThrow();
      },
    );

    it('passes the token to the file operations', async () => {
      await service.status('drop1234', 'file1234', TOKEN);
      await service.listParts('drop1234', 'file1234', TOKEN);
      await service.remove('drop1234', 'file1234', TOKEN);

      expect(uploads.status).toHaveBeenCalledWith(
        expect.anything(),
        'file1234',
        TOKEN,
      );
      expect(uploads.listParts).toHaveBeenCalledWith(
        expect.anything(),
        'file1234',
        TOKEN,
      );
      expect(uploads.remove).toHaveBeenCalledWith(
        expect.anything(),
        'file1234',
        { action: 'drops.files.cancelled', userId: null },
        TOKEN,
      );
    });

    it('a wrong token stays a plain 404 from the file layer', async () => {
      uploads.status.mockRejectedValue(new FileNotFoundException());

      await expect(
        service.status('drop1234', 'file1234', 'bad'),
      ).rejects.toBeInstanceOf(FileNotFoundException);
    });
  });

  describe('complete', () => {
    it('records the upload event and an audit without user, IP or token', async () => {
      await service.complete('drop1234', 'file1234', TOKEN, VISITOR);

      expect(events.recordUpload).toHaveBeenCalledWith('drop-uuid', VISITOR);
      expect(audit.record).toHaveBeenCalledWith({
        action: 'drops.files.received',
        userId: null,
        targetId: 'file1234',
        metadata: {
          dropId: 'drop1234',
          name: 'photo.jpg',
          size: 100,
          uploaderName: 'Alice',
        },
      });
      expect(JSON.stringify(audit.record.mock.calls)).not.toContain(TOKEN);
    });

    it('records nothing when the completion fails', async () => {
      uploads.complete.mockRejectedValue(new StorageQuotaExceededException());

      await expect(
        service.complete('drop1234', 'file1234', TOKEN, VISITOR),
      ).rejects.toBeInstanceOf(DropLimitExceededException);
      expect(events.recordUpload).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
