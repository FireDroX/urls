import type { LinkType } from '../../entities/link.entity.js';

export interface LinkResponseDto {
  id: string;
  type: LinkType;
  destination: string | null;
  expiresAt: string | null;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}
