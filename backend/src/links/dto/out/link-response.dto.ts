import type { LinkFolderDto, LinkTagDto } from './link-organization.dto.js';
import type {
  LinkCheckErrorKind,
  LinkCheckOutcome,
} from '../../../common/variables.global.js';
import type { LinkType } from '../../entities/link.entity.js';

export interface LinkLastCheckDto {
  outcome: LinkCheckOutcome;
  statusCode: number | null;
  errorKind: LinkCheckErrorKind | null;
  checkedAt: string;
  broken: boolean;
}

export interface LinkResponseDto {
  id: string;
  type: LinkType;
  destination: string | null;
  expiresAt: string | null;
  disabled: boolean;
  tags: LinkTagDto[];
  folder: LinkFolderDto | null;
  lastCheck: LinkLastCheckDto | null;
  createdAt: string;
  updatedAt: string;
}
