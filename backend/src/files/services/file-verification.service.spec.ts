import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_UNKNOWN_MIME } from '../../common/variables.global.js';
import type { StorageService } from '../../storage/services/storage.service.js';
import type { StoredFile } from '../entities/stored-file.entity.js';
import type { StoredFileRepository } from '../persistence/stored-file.repository.js';
import { FileVerificationService } from './file-verification.service.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
  Buffer.alloc(64),
]);

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function buildFile(content: Buffer, overrides: Partial<StoredFile> = {}) {
  return {
    id: 'file-uuid',
    publicId: 'file1234',
    linkId: 'share-uuid',
    s3Key: 'files/opaque',
    name: 'image.png',
    size: content.length,
    mime: null,
    sha256: sha256(content),
    status: 'verifying',
    uploadId: null,
    createdAt: new Date(),
    completedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('FileVerificationService', () => {
  let repository: {
    transition: ReturnType<typeof vi.fn>;
    findByStatus: ReturnType<typeof vi.fn>;
  };
  let storage: {
    getObjectSize: ReturnType<typeof vi.fn>;
    openObjectStream: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
  };
  let service: FileVerificationService;

  function storeObject(content: Buffer): void {
    storage.getObjectSize.mockResolvedValue(content.length);
    storage.openObjectStream = vi.fn(() =>
      Promise.resolve(Readable.from([content])),
    );
  }

  beforeEach(() => {
    repository = {
      transition: vi.fn().mockResolvedValue(true),
      findByStatus: vi.fn().mockResolvedValue([]),
    };
    storage = {
      getObjectSize: vi.fn(),
      openObjectStream: vi.fn(),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };
    service = new FileVerificationService(
      repository as unknown as StoredFileRepository,
      storage as unknown as StorageService,
    );
  });

  it('marks a matching file ready with the MIME type detected from its content', async () => {
    storeObject(PNG);

    await expect(
      service.verify(buildFile(PNG, { name: 'x.txt' })),
    ).resolves.toBe('ready');
    expect(repository.transition).toHaveBeenCalledWith(
      'file-uuid',
      'verifying',
      { status: 'ready', mime: 'image/png' },
    );
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('falls back to application/octet-stream when the content is not recognized', async () => {
    const text = Buffer.from('plain text');
    storeObject(text);

    await service.verify(buildFile(text));

    expect(repository.transition).toHaveBeenCalledWith(
      'file-uuid',
      'verifying',
      { status: 'ready', mime: FILE_UNKNOWN_MIME },
    );
  });

  it('rejects and deletes an object whose size differs from the announced one', async () => {
    storeObject(PNG);

    await expect(
      service.verify(buildFile(PNG, { size: PNG.length + 1 })),
    ).resolves.toBe('rejected');
    expect(storage.openObjectStream).not.toHaveBeenCalled();
    expect(repository.transition).toHaveBeenCalledWith(
      'file-uuid',
      'verifying',
      { status: 'rejected' },
    );
    expect(storage.deleteObject).toHaveBeenCalledWith('files/opaque');
  });

  it('rejects and deletes an object whose SHA-256 differs from the announced one', async () => {
    storeObject(PNG);

    await expect(
      service.verify(buildFile(PNG, { sha256: 'f'.repeat(64) })),
    ).resolves.toBe('rejected');
    expect(repository.transition).toHaveBeenCalledWith(
      'file-uuid',
      'verifying',
      { status: 'rejected' },
    );
    expect(storage.deleteObject).toHaveBeenCalledWith('files/opaque');
  });

  it('leaves the file verifying when storage cannot be read', async () => {
    storage.getObjectSize.mockRejectedValue(new Error('timeout'));

    await expect(service.verify(buildFile(PNG))).resolves.toBeNull();
    expect(repository.transition).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('resumes the verifications interrupted by a restart', async () => {
    storeObject(PNG);
    repository.findByStatus.mockResolvedValue([buildFile(PNG)]);

    service.onApplicationBootstrap();
    await vi.waitFor(() =>
      expect(repository.transition).toHaveBeenCalledWith(
        'file-uuid',
        'verifying',
        { status: 'ready', mime: 'image/png' },
      ),
    );
    expect(repository.findByStatus).toHaveBeenCalledWith('verifying');
  });
});
