import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import type { Link } from '../../links/entities/link.entity.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';
import { FileDeletionService } from './file-deletion.service.js';

const link = { publicId: 'share123', type: 'share' } as Link;

function buildFile(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: 'file-uuid',
    publicId: 'file1234',
    s3Key: 'files/opaque',
    status: 'ready',
    uploadId: null,
    ...overrides,
  } as StoredFile;
}

describe('FileDeletionService', () => {
  let repository: { softDelete: ReturnType<typeof vi.fn> };
  let storage: {
    abortMultipartUpload: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: FileDeletionService;

  beforeEach(() => {
    repository = { softDelete: vi.fn().mockResolvedValue(undefined) };
    storage = {
      abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new FileDeletionService(
      repository as unknown as StoredFileRepository,
      storage as unknown as StorageService,
      audit as unknown as AuditLogService,
    );
  });

  it('aborts the multipart upload in progress, then soft-deletes and audits', async () => {
    await service.erase(
      buildFile({ status: 'uploading', uploadId: 'upload-1' }),
      link,
      'user-1',
    );

    expect(storage.abortMultipartUpload).toHaveBeenCalledWith(
      'files/opaque',
      'upload-1',
    );
    expect(repository.softDelete).toHaveBeenCalledWith('file-uuid');
    expect(audit.record).toHaveBeenCalledWith({
      action: 'files.deleted',
      userId: 'user-1',
      targetId: 'file1234',
      metadata: { linkId: 'share123', linkType: 'share', status: 'uploading' },
    });
  });

  it('deletes the object once, after the soft delete, when the abort succeeds', async () => {
    await service.erase(
      buildFile({ status: 'uploading', uploadId: 'upload-1' }),
      link,
      'user-1',
    );

    expect(storage.deleteObject).toHaveBeenCalledOnce();
    expect(storage.deleteObject).toHaveBeenCalledWith('files/opaque');
    expect(repository.softDelete.mock.invocationCallOrder[0]).toBeLessThan(
      storage.deleteObject.mock.invocationCallOrder[0],
    );
  });

  it.each([
    [
      'the abort succeeds',
      () => undefined,
      (deleteObject: ReturnType<typeof vi.fn>) =>
        deleteObject.mockRejectedValue(new StorageUnavailableException()),
    ],
    [
      'the upload is already gone',
      (abort: ReturnType<typeof vi.fn>) =>
        abort.mockRejectedValue(new UploadNotFoundException()),
      (deleteObject: ReturnType<typeof vi.fn>) =>
        deleteObject
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new StorageUnavailableException()),
    ],
  ])(
    'logs and still audits when the deletion after the soft delete fails and %s',
    async (_label, setupAbort, setupDelete) => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      setupAbort(storage.abortMultipartUpload);
      setupDelete(storage.deleteObject);

      await expect(
        service.erase(
          buildFile({ status: 'uploading', uploadId: 'upload-1' }),
          link,
          'user-1',
        ),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        'Object files/opaque may be orphaned after a concurrent upload completion',
      );
      expect(repository.softDelete).toHaveBeenCalledOnce();
      expect(audit.record).toHaveBeenCalledOnce();
      warn.mockRestore();
    },
  );

  it('throws before the soft delete when the abort fails for another reason', async () => {
    storage.abortMultipartUpload.mockRejectedValue(
      new StorageUnavailableException(),
    );

    await expect(
      service.erase(
        buildFile({ status: 'uploading', uploadId: 'upload-1' }),
        link,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(StorageUnavailableException);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('deletes the object before and after the soft delete when the upload is already gone', async () => {
    storage.abortMultipartUpload.mockRejectedValue(
      new UploadNotFoundException(),
    );

    await service.erase(
      buildFile({ status: 'uploading', uploadId: 'upload-1' }),
      link,
      'user-1',
    );

    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
    expect(storage.deleteObject).toHaveBeenNthCalledWith(1, 'files/opaque');
    expect(storage.deleteObject).toHaveBeenNthCalledWith(2, 'files/opaque');
    const [first, second] = storage.deleteObject.mock.invocationCallOrder;
    expect(first).toBeLessThan(
      repository.softDelete.mock.invocationCallOrder[0],
    );
    expect(repository.softDelete.mock.invocationCallOrder[0]).toBeLessThan(
      second,
    );
    expect(second).toBeLessThan(audit.record.mock.invocationCallOrder[0]);
  });

  it('throws before the soft delete when the first deletion fails after a gone upload', async () => {
    storage.abortMultipartUpload.mockRejectedValue(
      new UploadNotFoundException(),
    );
    storage.deleteObject.mockRejectedValue(new StorageUnavailableException());

    await expect(
      service.erase(
        buildFile({ status: 'uploading', uploadId: 'upload-1' }),
        link,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(StorageUnavailableException);
    expect(storage.deleteObject).toHaveBeenCalledOnce();
    expect(repository.softDelete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each(['ready', 'verifying', 'rejected'] as const)(
    'deletes the object of a %s file',
    async (status) => {
      await service.erase(buildFile({ status }), link, 'user-1');

      expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
      expect(storage.deleteObject).toHaveBeenCalledOnce();
      expect(storage.deleteObject).toHaveBeenCalledWith('files/opaque');
      expect(storage.deleteObject.mock.invocationCallOrder[0]).toBeLessThan(
        repository.softDelete.mock.invocationCallOrder[0],
      );
    },
  );

  it('removes the object before the row', async () => {
    await service.erase(buildFile(), link, 'user-1');

    expect(storage.deleteObject.mock.invocationCallOrder[0]).toBeLessThan(
      repository.softDelete.mock.invocationCallOrder[0],
    );
  });

  it.each([
    ['abort', { status: 'uploading' as const, uploadId: 'upload-1' }],
    ['delete', {}],
  ])('keeps the row and the audit when the %s fails', async (_label, file) => {
    storage.abortMultipartUpload.mockRejectedValue(
      new StorageUnavailableException(),
    );
    storage.deleteObject.mockRejectedValue(new StorageUnavailableException());

    await expect(
      service.erase(buildFile(file), link, 'user-1'),
    ).rejects.toBeInstanceOf(StorageUnavailableException);
    expect(repository.softDelete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
