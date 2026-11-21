export interface PublicShareFileResponseDto {
  id: string;
  name: string;
  size: number;
}

export interface PublicShareResponseDto {
  id: string;
  expiresAt: string | null;
  fileCount: number;
  totalSize: number;
  files: PublicShareFileResponseDto[];
}

export interface ShareDownloadResponseDto {
  url: string;
}
