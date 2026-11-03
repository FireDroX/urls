import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { FileIdTakenException } from '../../common/exceptions/files/file-id-taken.exception.js';
import { FileNotFoundException } from '../../common/exceptions/files/file-not-found.exception.js';
import { FileNotUploadingException } from '../../common/exceptions/files/file-not-uploading.exception.js';
import { FileTooLargeException } from '../../common/exceptions/files/file-too-large.exception.js';
import { PartTooLargeException } from '../../common/exceptions/files/part-too-large.exception.js';
import { TooManyFilesException } from '../../common/exceptions/files/too-many-files.exception.js';
import { UploadIncompleteException } from '../../common/exceptions/files/upload-incomplete.exception.js';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import {
  FILE_MAX_SIZE_BYTES,
  FILE_NAME_MAX_LENGTH,
  FILE_PART_SIZE_BYTES,
  FILE_S3_KEY_PREFIX,
  FILES_STORAGE_QUOTA_BYTES,
  PUBLIC_ID_GENERATION_ATTEMPTS,
  SHARE_FILES_MAX,
} from '../../common/variables.global.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type {
  NewStoredFile,
  StoredFileRepository,
} from '../persistence/stored-file.repository.js';
import type { FileVerificationService } from './file-verification.service.js';
import {
  FileUploadsService,
  type IncomingPart,
} from './file-uploads.service.js';

const USER_ID = 'user-1';
const SHA256 = 'ab'.repeat(32);
const SIZE = 2 * FILE_PART_SIZE_BYTES + 10;

const share = {
  id: 'share-uuid',
  publicId: 'share123',
  type: 'share',
} as Link;

function buildFile(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: 'file-uuid',
    publicId: 'file1234',
    linkId: share.id,
    s3Key: 'files/opaque',
    name: 'video.mp4',
    size: SIZE,
    mime: null,
    sha256: SHA256,
    status: 'uploading',
    uploadId: 'upload-1',
    createdAt: new Date('2026-11-03T00:00:00Z'),
    completedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function incomingPart(
  body: string,
  headers: Record<string, string> = {},
): IncomingPart {
  return Object.assign(Readable.from([Buffer.from(body)]), { headers });
}

function part(partNumber: number, size: number) {
  return { partNumber, size, etag: `"e${partNumber}"` };
}

describe('FileUploadsService', () => {
  let repository: {
    [K in keyof StoredFileRepository]: ReturnType<typeof vi.fn>;
  };
  let storage: { [K in keyof StorageService]: ReturnType<typeof vi.fn> };
  let verification: { schedule: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: FileUploadsService;

  beforeEach(() => {
    repository = {
      findByLinkId: vi.fn(),
      summarizeByLinkIds: vi.fn(),
      findInLink: vi.fn().mockResolvedValue(buildFile()),
      findByStatus: vi.fn(),
      insertWithinLimits: vi.fn((file: NewStoredFile) =>
        Promise.resolve(buildFile({ ...file })),
      ),
      transition: vi.fn().mockResolvedValue(true),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    storage = {
      getUsage: vi.fn(),
      getPresignedDownloadUrl: vi.fn(),
      createMultipartUpload: vi.fn().mockResolvedValue('upload-1'),
      uploadPart: vi.fn().mockResolvedValue(undefined),
      listParts: vi.fn().mockResolvedValue([]),
      completeMultipartUpload: vi.fn().mockResolvedValue(undefined),
      abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
      getObjectSize: vi.fn(),
      openObjectStream: vi.fn(),
      deleteObject: vi.fn(),
    };
    verification = { schedule: vi.fn() };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new FileUploadsService(
      repository as unknown as StoredFileRepository,
      storage as unknown as StorageService,
      verification as unknown as FileVerificationService,
      audit as unknown as AuditLogService,
    );
  });

  describe('start', () => {
    const input = { name: 'video.mp4', size: SIZE, sha256: SHA256 };

    it('opens a multipart upload under an opaque key and returns the part plan', async () => {
      const started = await service.start(share, input, USER_ID);

      const [key] = storage.createMultipartUpload.mock.calls[0] as [string];
      expect(key.startsWith(FILE_S3_KEY_PREFIX)).toBe(true);
      expect(key).not.toContain('video');
      expect(repository.insertWithinLimits).toHaveBeenCalledWith(
        expect.objectContaining({
          linkId: share.id,
          s3Key: key,
          uploadId: 'upload-1',
          name: 'video.mp4',
          size: SIZE,
          sha256: SHA256,
        }),
        { maxFiles: SHARE_FILES_MAX, quotaBytes: FILES_STORAGE_QUOTA_BYTES },
      );
      expect(started.partSize).toBe(FILE_PART_SIZE_BYTES);
      expect(started.partCount).toBe(3);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'files.created', userId: USER_ID }),
      );
    });

    it('cleans the name: no path, no control or invisible characters', async () => {
      await service.start(
        share,
        { ...input, name: '../../etc/‮gnp.exe\u0007 ' },
        USER_ID,
      );

      expect(repository.insertWithinLimits).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'gnp.exe' }),
        expect.anything(),
      );
    });

    it('normalizes the announced SHA-256 to lower case', async () => {
      await service.start(
        share,
        { ...input, sha256: SHA256.toUpperCase() },
        USER_ID,
      );

      expect(repository.insertWithinLimits).toHaveBeenCalledWith(
        expect.objectContaining({ sha256: SHA256 }),
        expect.anything(),
      );
    });

    it.each([
      { name: '', size: SIZE, sha256: SHA256 },
      { name: '..', size: SIZE, sha256: SHA256 },
      { name: 'a/', size: SIZE, sha256: SHA256 },
      {
        name: 'x'.repeat(FILE_NAME_MAX_LENGTH + 1),
        size: SIZE,
        sha256: SHA256,
      },
      { name: 'a', size: 0, sha256: SHA256 },
      { name: 'a', size: 1.5, sha256: SHA256 },
      { name: 'a', size: SIZE, sha256: 'xyz' },
      { name: 'a', size: SIZE, sha256: SHA256, mime: 'text/plain' },
    ])('refuses invalid input with a 400 (%o)', async (body) => {
      await expect(service.start(share, body, USER_ID)).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(storage.createMultipartUpload).not.toHaveBeenCalled();
    });

    it('refuses a file over the maximum size before touching storage', async () => {
      await expect(
        service.start(
          share,
          { ...input, size: FILE_MAX_SIZE_BYTES + 1 },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(FileTooLargeException);
      expect(storage.createMultipartUpload).not.toHaveBeenCalled();
    });

    it.each([
      ['the quota is exhausted', new StorageQuotaExceededException()],
      ['the share is full', new TooManyFilesException()],
    ])(
      'aborts the multipart upload and answers 413 when %s',
      async (_case, error) => {
        repository.insertWithinLimits.mockRejectedValue(error);

        await expect(service.start(share, input, USER_ID)).rejects.toBe(error);
        expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
          expect.stringMatching(/^files\//),
          'upload-1',
        );
        expect(audit.record).not.toHaveBeenCalled();
      },
    );

    it('retries a public id collision', async () => {
      repository.insertWithinLimits
        .mockRejectedValueOnce(new FileIdTakenException())
        .mockResolvedValueOnce(buildFile());

      await service.start(share, input, USER_ID);

      expect(repository.insertWithinLimits).toHaveBeenCalledTimes(2);
    });

    it('gives up after PUBLIC_ID_GENERATION_ATTEMPTS collisions', async () => {
      repository.insertWithinLimits.mockRejectedValue(
        new FileIdTakenException(),
      );

      await expect(service.start(share, input, USER_ID)).rejects.toBeInstanceOf(
        FileIdTakenException,
      );
      expect(repository.insertWithinLimits).toHaveBeenCalledTimes(
        PUBLIC_ID_GENERATION_ATTEMPTS,
      );
    });
  });

  describe('uploadPart', () => {
    it('streams the part to storage with its expected size', async () => {
      const received = await service.uploadPart(
        share,
        'file1234',
        '3',
        incomingPart('0123456789', { 'content-length': '10' }),
      );

      expect(received).toEqual({ partNumber: 3, size: 10 });
      const [key, uploadId, partNumber, body, size] = storage.uploadPart.mock
        .calls[0] as [string, string, number, Readable, number];
      expect([key, uploadId, partNumber, size]).toEqual([
        'files/opaque',
        'upload-1',
        3,
        10,
      ]);
      expect(body).toBeInstanceOf(Readable);
    });

    it('answers 400 when Content-Length is missing or not the expected size', async () => {
      await expect(
        service.uploadPart(share, 'file1234', '3', incomingPart('0123')),
      ).rejects.toBeInstanceOf(ValidationException);
      await expect(
        service.uploadPart(
          share,
          'file1234',
          '3',
          incomingPart('0123', { 'content-length': '4' }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(storage.uploadPart).not.toHaveBeenCalled();
    });

    it('answers 400 for a part number outside the plan', async () => {
      await expect(
        service.uploadPart(
          share,
          'file1234',
          '4',
          incomingPart('', { 'content-length': '0' }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('cuts a body that goes over the expected size with a 413', async () => {
      storage.uploadPart = vi.fn(async (...args: unknown[]) => {
        for await (const chunk of args[3] as Readable) {
          void chunk;
        }
      });

      await expect(
        service.uploadPart(
          share,
          'file1234',
          '3',
          incomingPart('01234567890', { 'content-length': '10' }),
        ),
      ).rejects.toBeInstanceOf(PartTooLargeException);
    });

    it('answers 404 for an unknown or malformed file id', async () => {
      repository.findInLink.mockResolvedValue(null);

      await expect(
        service.uploadPart(share, 'nope1234', '1', incomingPart('')),
      ).rejects.toBeInstanceOf(FileNotFoundException);
      await expect(
        service.uploadPart(share, '../x', '1', incomingPart('')),
      ).rejects.toBeInstanceOf(FileNotFoundException);
      expect(repository.findInLink).toHaveBeenCalledTimes(1);
      expect(repository.findInLink).toHaveBeenCalledWith(share.id, 'nope1234');
    });

    it('answers 409 when the file is no longer uploading', async () => {
      repository.findInLink.mockResolvedValue(
        buildFile({ status: 'verifying', uploadId: null }),
      );

      await expect(
        service.uploadPart(share, 'file1234', '1', incomingPart('')),
      ).rejects.toBeInstanceOf(FileNotUploadingException);
    });

    it('answers 409 when storage no longer knows the upload', async () => {
      storage.uploadPart.mockRejectedValue(new UploadNotFoundException());

      await expect(
        service.uploadPart(
          share,
          'file1234',
          '3',
          incomingPart('0123456789', { 'content-length': '10' }),
        ),
      ).rejects.toBeInstanceOf(FileNotUploadingException);
    });
  });

  describe('complete', () => {
    const allParts = [
      part(1, FILE_PART_SIZE_BYTES),
      part(2, FILE_PART_SIZE_BYTES),
      part(3, 10),
    ];

    it('completes the upload, moves the file to verifying and schedules the check', async () => {
      storage.listParts.mockResolvedValue([...allParts].reverse());

      const file = await service.complete(share, 'file1234');

      expect(storage.completeMultipartUpload).toHaveBeenCalledWith(
        'files/opaque',
        'upload-1',
        allParts,
      );
      expect(repository.transition).toHaveBeenCalledWith(
        'file-uuid',
        'uploading',
        expect.objectContaining({ status: 'verifying', uploadId: null }),
      );
      expect(file.status).toBe('verifying');
      expect(verification.schedule).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'file-uuid', status: 'verifying' }),
      );
    });

    it('answers 409 when parts are missing or mis-sized', async () => {
      storage.listParts.mockResolvedValue([allParts[0], allParts[2]]);

      await expect(service.complete(share, 'file1234')).rejects.toBeInstanceOf(
        UploadIncompleteException,
      );

      storage.listParts.mockResolvedValue([
        allParts[0],
        part(2, FILE_PART_SIZE_BYTES - 1),
        allParts[2],
      ]);
      await expect(service.complete(share, 'file1234')).rejects.toBeInstanceOf(
        UploadIncompleteException,
      );
      expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('answers 413 when RustFS refuses the completion over its quota', async () => {
      storage.listParts.mockResolvedValue(allParts);
      storage.completeMultipartUpload.mockRejectedValue(
        new StorageQuotaExceededException(),
      );

      await expect(service.complete(share, 'file1234')).rejects.toBeInstanceOf(
        StorageQuotaExceededException,
      );
      expect(repository.transition).not.toHaveBeenCalled();
      expect(verification.schedule).not.toHaveBeenCalled();
    });

    it('answers 409 when another call completed the file first', async () => {
      storage.listParts.mockResolvedValue(allParts);
      repository.transition.mockResolvedValue(false);

      await expect(service.complete(share, 'file1234')).rejects.toBeInstanceOf(
        FileNotUploadingException,
      );
      expect(verification.schedule).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('aborts an upload in progress, soft-deletes the file and audits it', async () => {
      await service.remove(share, 'file1234', USER_ID);

      expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
        'files/opaque',
        'upload-1',
      );
      expect(repository.softDelete).toHaveBeenCalledWith('file-uuid');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'files.deleted',
          targetId: 'file1234',
        }),
      );
    });

    it('soft-deletes a finished file without touching storage', async () => {
      repository.findInLink.mockResolvedValue(
        buildFile({ status: 'ready', uploadId: null }),
      );

      await service.remove(share, 'file1234', USER_ID);

      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
      expect(repository.softDelete).toHaveBeenCalledWith('file-uuid');
    });

    it('still deletes the row when the abort fails', async () => {
      storage.abortMultipartUpload.mockRejectedValue(new Error('timeout'));

      await service.remove(share, 'file1234', USER_ID);

      expect(repository.softDelete).toHaveBeenCalledWith('file-uuid');
    });

    it('answers 404 for an unknown file', async () => {
      repository.findInLink.mockResolvedValue(null);

      await expect(
        service.remove(share, 'file1234', USER_ID),
      ).rejects.toBeInstanceOf(FileNotFoundException);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});
