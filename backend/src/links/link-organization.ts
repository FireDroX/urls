import type { Folder } from '../folders/entities/folder.entity.js';
import type { Tag } from '../tags/entities/tag.entity.js';
import type { Link } from './entities/link.entity.js';

export interface LinkOrganization {
  tags: Tag[];
  folder: Folder | null;
}

export const EMPTY_LINK_ORGANIZATION: LinkOrganization = {
  tags: [],
  folder: null,
};

export interface OrganizationInput {
  tagIds?: string[];
  folderId?: string | null;
}

export interface ResolvedOrganization {
  tagIds?: string[];
  folderId?: string | null;
}

export interface LinkWithOrganization {
  link: Link;
  organization: LinkOrganization;
}
