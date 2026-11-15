import { describe, expect, it } from 'vitest';
import type { StoredFile } from '../../files/entities/stored-file.entity.js';
import type { Link } from '../../links/entities/link.entity.js';
import { EMPTY_LINK_ORGANIZATION } from '../../links/link-organization.js';
import { DropsMapper } from './drops.mapper.js';

describe('DropsMapper.toDetailResponse', () => {
  it('exposes files with their sender and no internal field', () => {
    const file = {
      id: 'file-uuid',
      linkId: 'drop-uuid',
      publicId: 'file1234',
      name: 'photo.png',
      size: 12,
      mime: 'image/png',
      status: 'ready',
      s3Key: 'files/secret',
      uploadId: 'upload-secret',
      uploadTokenHash: 'hash',
      sha256: 'abc',
      uploaderName: 'Alice',
      createdAt: new Date('2026-11-02T00:00:00Z'),
      completedAt: null,
    } as unknown as StoredFile;
    const drop = {
      id: 'drop-uuid',
      publicId: 'drop1234',
      title: null,
      maxTotalBytes: 10,
      maxFiles: 2,
      expiresAt: null,
      disabled: false,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
    } as unknown as Link;

    const { data } = DropsMapper.toDetailResponse({
      drop,
      organization: EMPTY_LINK_ORGANIZATION,
      fileCount: 1,
      totalSize: 12,
      state: 'open',
      files: [file],
      viewCount: 3,
    });

    expect(data?.viewCount).toBe(3);
    expect(data?.files[0]).toEqual({
      id: 'file1234',
      name: 'photo.png',
      size: 12,
      mime: 'image/png',
      status: 'ready',
      uploaderName: 'Alice',
      createdAt: '2026-11-02T00:00:00.000Z',
      completedAt: null,
    });
    const serialized = JSON.stringify(data);
    for (const secret of [
      'file-uuid',
      'drop-uuid',
      'files/secret',
      'upload-secret',
      'hash',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
