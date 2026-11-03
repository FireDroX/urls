import type { Readable } from 'node:stream';

export interface StorageUsage {
  usedBytes: number | null;
  quotaBytes: number | null;
}

export interface UploadedPart {
  partNumber: number;
  size: number;
  etag: string;
}

export interface StorageService {
  getUsage(): Promise<StorageUsage>;
  getPresignedDownloadUrl(
    key: string,
    filename: string,
    expiresInSeconds: number,
  ): Promise<string>;
  createMultipartUpload(key: string): Promise<string>;
  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Readable,
    size: number,
  ): Promise<void>;
  listParts(key: string, uploadId: string): Promise<UploadedPart[]>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[],
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  getObjectSize(key: string): Promise<number>;
  openObjectStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
}
