import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { S3_DEFAULT_REGION } from '../common/variables.global.js';

export interface StorageSettings {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function storageSettingsFrom(config: ConfigService): StorageSettings {
  const endpoint = config.get<string>('S3_ENDPOINT')!;
  return {
    endpoint,
    publicEndpoint: config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint,
    region: config.get<string>('S3_REGION') || S3_DEFAULT_REGION,
    bucket: config.get<string>('S3_BUCKET')!,
    accessKeyId: config.get<string>('S3_ACCESS_KEY')!,
    secretAccessKey: config.get<string>('S3_SECRET_KEY')!,
  };
}

export function s3ClientFor(
  settings: StorageSettings,
  endpoint: string,
): S3Client {
  return new S3Client({
    endpoint,
    region: settings.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}
