import type { LinkFolderDto, LinkTagDto } from './link-organization.dto.js';
import type { LinkType } from '../../entities/link.entity.js';

export interface LinkResponseDto {
  id: string;
  type: LinkType;
  destination: string | null;
  expiresAt: string | null;
  disabled: boolean;
  tags: LinkTagDto[];
  folder: LinkFolderDto | null;
  createdAt: string;
  updatedAt: string;
}
