export interface StorageUsage {
  usedBytes: number | null;
  quotaBytes: number | null;
}

export interface StorageService {
  getUsage(): Promise<StorageUsage>;
  getPresignedDownloadUrl(
    key: string,
    filename: string,
    expiresInSeconds: number,
  ): Promise<string>;
}
