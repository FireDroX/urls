import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../services/files-admin.service.js';
import { FilesMapper } from './files.mapper.js';

const entry = {
  file: {
    id: 'file-uuid',
    publicId: 'file1234',
    linkId: 'link-uuid',
    s3Key: 'files/opaque',
    uploadId: 'upload-1',
    name: 'report.pdf',
    size: 42,
    mime: 'application/pdf',
    status: 'uploading',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    completedAt: null,
    link: {
      id: 'link-uuid',
      type: 'share',
      publicId: 'share123',
      deletedAt: null,
      disabled: true,
    },
  },
  inUse: true,
  expired: false,
} as unknown as FileEntry;

describe('FilesMapper', () => {
  it('gives the exact list shape without any internal id, S3 key or upload id', () => {
    const response = FilesMapper.toListResponse({
      files: [entry],
      summary: {
        quotaUsedBytes: 1,
        quotaLimitBytes: 2,
        orphanBytes: 3,
        storageUsedBytes: null,
      },
    });

    expect(response.data).toEqual({
      files: [
        {
          publicId: 'file1234',
          name: 'report.pdf',
          size: 42,
          mime: 'application/pdf',
          status: 'uploading',
          createdAt: '2026-01-02T03:04:05.000Z',
          completedAt: null,
          inUse: true,
          link: {
            type: 'share',
            publicId: 'share123',
            deleted: false,
            disabled: true,
            expired: false,
          },
        },
      ],
      summary: {
        quotaUsedBytes: 1,
        quotaLimitBytes: 2,
        orphanBytes: 3,
        storageUsedBytes: null,
      },
    });
    const serialized = JSON.stringify(response.data);
    for (const leaked of [
      'file-uuid',
      'link-uuid',
      'files/opaque',
      'upload-1',
    ]) {
      expect(serialized).not.toContain(leaked);
    }
  });
});
