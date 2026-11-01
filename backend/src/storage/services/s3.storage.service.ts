import { Sha256 } from '@aws-crypto/sha256-js';
import {
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { SignatureV4 } from '@smithy/signature-v4';
import { StorageUnavailableException } from '../../common/exceptions/storage/storage-unavailable.exception.js';
import { S3_ADMIN_TIMEOUT_MS } from '../../common/variables.global.js';
import type { StorageSettings } from '../storage.config.js';
import type { StorageService, StorageUsage } from './storage.service.js';

interface RustfsQuotaStats {
  quota_limit?: number | null;
  current_usage?: number | null;
}

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

function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
