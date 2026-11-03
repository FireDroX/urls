import type { Readable } from 'node:stream';
import { Sha256 } from '@aws-crypto/sha256-js';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { SignatureV4 } from '@smithy/signature-v4';
import { StorageQuotaExceededException } from '../../common/exceptions/storage/storage-quota-exceeded.exception.js';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { UploadNotFoundException } from '../../common/exceptions/storage/upload-not-found.exception.js';
import {
  FILE_UNKNOWN_MIME,
  S3_ADMIN_TIMEOUT_MS,
  S3_LIST_PARTS_PAGE_SIZE,
} from '../../common/variables.global.js';
import type { StorageSettings } from '../storage.config.js';
import type {
  StorageService,
  StorageUsage,
  UploadedPart,
} from './storage.service.js';

interface RustfsQuotaStats {
  quota_limit?: number | null;
  current_usage?: number | null;
}

const QUOTA_EXCEEDED_PATTERN = /quota exceeded/i;
const NO_SUCH_UPLOAD = 'NoSuchUpload';

@Injectable()
export class S3StorageService
  implements StorageService, OnApplicationBootstrap
{
  private readonly logger = new Logger(S3StorageService.name);

  constructor(
    @Inject('StorageSettings') private readonly settings: StorageSettings,
    @Inject('S3InternalClient') private readonly internalClient: S3Client,
    @Inject('S3PresignClient') private readonly presignClient: S3Client,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.internalClient.send(
        new HeadBucketCommand({ Bucket: this.settings.bucket }),
      );
    } catch (error) {
      this.logger.error(
        `Bucket "${this.settings.bucket}" is not reachable with the configured credentials`,
        error,
      );
    }
  }

  async getUsage(): Promise<StorageUsage> {
    const stats = await this.fetchQuotaStats();
    return {
      usedBytes: stats.current_usage ?? null,
      quotaBytes: stats.quota_limit ?? null,
    };
  }

  getPresignedDownloadUrl(
    key: string,
    filename: string,
    expiresInSeconds: number,
  ): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(filename),
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async createMultipartUpload(key: string): Promise<string> {
    const { UploadId } = await this.run('CreateMultipartUpload', () =>
      this.internalClient.send(
        new CreateMultipartUploadCommand({
          Bucket: this.settings.bucket,
          Key: key,
          ContentType: FILE_UNKNOWN_MIME,
        }),
      ),
    );
    if (!UploadId) {
      this.logger.error('CreateMultipartUpload answered without an UploadId');
      throw new StorageUnavailableException();
    }
    return UploadId;
  }

  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Readable,
    size: number,
  ): Promise<void> {
    try {
      await this.internalClient.send(
        new UploadPartCommand({
          Bucket: this.settings.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: body,
          ContentLength: size,
        }),
      );
    } catch (error) {
      if (body.errored) {
        throw body.errored;
      }
      throw this.translate('UploadPart', error);
    }
  }

  async listParts(key: string, uploadId: string): Promise<UploadedPart[]> {
    const parts: UploadedPart[] = [];
    let marker: string | undefined;
    do {
      const page = await this.run('ListParts', () =>
        this.internalClient.send(
          new ListPartsCommand({
            Bucket: this.settings.bucket,
            Key: key,
            UploadId: uploadId,
            MaxParts: S3_LIST_PARTS_PAGE_SIZE,
            PartNumberMarker: marker,
          }),
        ),
      );
      for (const part of page.Parts ?? []) {
        parts.push({
          partNumber: part.PartNumber ?? 0,
          size: part.Size ?? 0,
          etag: part.ETag ?? '',
        });
      }
      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[],
  ): Promise<void> {
    await this.run('CompleteMultipartUpload', () =>
      this.internalClient.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.settings.bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map(({ partNumber, etag }) => ({
              PartNumber: partNumber,
              ETag: etag,
            })),
          },
        }),
      ),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.run('AbortMultipartUpload', () =>
      this.internalClient.send(
        new AbortMultipartUploadCommand({
          Bucket: this.settings.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      ),
    );
  }

  async getObjectSize(key: string): Promise<number> {
    const { ContentLength } = await this.run('HeadObject', () =>
      this.internalClient.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      ),
    );
    return ContentLength ?? 0;
  }

  async openObjectStream(key: string): Promise<Readable> {
    const { Body } = await this.run('GetObject', () =>
      this.internalClient.send(
        new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      ),
    );
    if (!Body) {
      this.logger.error('GetObject answered without a body');
      throw new StorageUnavailableException();
    }
    return Body as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    await this.run('DeleteObject', () =>
      this.internalClient.send(
        new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      ),
    );
  }

  private async run<Output>(
    operation: string,
    request: () => Promise<Output>,
  ): Promise<Output> {
    try {
      return await request();
    } catch (error) {
      throw this.translate(operation, error);
    }
  }

  private translate(operation: string, error: unknown): Error {
    if (isQuotaExceeded(error)) {
      return new StorageQuotaExceededException();
    }
    if (isNoSuchUpload(error)) {
      return new UploadNotFoundException();
    }
    this.logger.error(`S3 ${operation} failed`, error);
    return new StorageUnavailableException();
  }

  private async fetchQuotaStats(): Promise<RustfsQuotaStats> {
    const url = new URL(
      `/rustfs/admin/v3/quota-stats/${encodeURIComponent(this.settings.bucket)}`,
      this.settings.endpoint,
    );
    const signer = new SignatureV4({
      service: 's3',
      region: this.settings.region,
      credentials: {
        accessKeyId: this.settings.accessKeyId,
        secretAccessKey: this.settings.secretAccessKey,
      },
      sha256: Sha256,
    });
    const signed = await signer.sign({
      method: 'GET',
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      path: url.pathname,
      query: {},
      headers: { host: url.host },
    });
    try {
      const response = await fetch(url, {
        headers: signed.headers,
        signal: AbortSignal.timeout(S3_ADMIN_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`quota-stats answered ${response.status}`);
      }
      return (await response.json()) as RustfsQuotaStats;
    } catch (error) {
      this.logger.error('Could not read the bucket quota stats', error);
      throw new StorageUnavailableException();
    }
  }
}

function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const { Code } = error as Error & { Code?: unknown };
  return [error.name, error.message, Code].some(
    (value) => typeof value === 'string' && QUOTA_EXCEEDED_PATTERN.test(value),
  );
}

function isNoSuchUpload(error: unknown): boolean {
  return error instanceof Error && error.name === NO_SUCH_UPLOAD;
}

function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
