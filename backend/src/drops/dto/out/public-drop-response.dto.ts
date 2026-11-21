export interface PublicDropResponseDto {
  id: string;
  title: string | null;
  maxFiles: number;
  maxTotalBytes: number;
  filesRemaining: number;
  bytesRemaining: number;
  expiresAt: string | null;
}
