import { describe, expect, it } from 'vitest';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import { ShareFilesMapper } from './share-files.mapper.js';

const SHA256 = 'ab'.repeat(32);

const file = {
  id: 'file-uuid',
  publicId: 'file1234',
  linkId: 'share-uuid',
  s3Key: 'files/opaque',
  uploadId: 'upload-1',
  uploaderName: null,
  uploadTokenHash: null,
  size: 42,
  sha256: SHA256,
} as StoredFile;

describe('ShareFilesMapper', () => {
  it('gives the upload parts without any internal id, S3 key or upload id', () => {
    const response = ShareFilesMapper.toUploadPartsResponse({
      file,
      partSize: 32,
      partCount: 2,
      parts: [{ partNumber: 1, size: 32 }],
    });

    expect(response.data).toEqual({
      fileId: 'file1234',
      size: 42,
      sha256: SHA256,
      partSize: 32,
      partCount: 2,
      parts: [{ partNumber: 1, size: 32 }],
    });
  });
});
