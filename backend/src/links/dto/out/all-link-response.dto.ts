import type { AllLinksListState } from '../../../common/variables.global.js';
import type { LinkType } from '../../entities/link.entity.js';
import type { LinkFolderDto, LinkTagDto } from './link-organization.dto.js';

export interface AllLinkResponseDto {
  type: LinkType;
  id: string;
  destination: string | null;
  title: string | null;
  state: AllLinksListState;
  tags: LinkTagDto[];
  folder: LinkFolderDto | null;
  expiresAt: string | null;
  disabled: boolean;
  createdAt: string;
  updatedAt: string;
}
