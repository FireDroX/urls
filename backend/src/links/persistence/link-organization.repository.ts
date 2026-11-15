import type { Folder } from '../../folders/entities/folder.entity.js';
import type { Tag } from '../../tags/entities/tag.entity.js';

export interface LinkOrganizationRepository {
  findTagsByLinkIds(linkIds: string[]): Promise<Map<string, Tag[]>>;
  findFoldersByIds(folderIds: string[]): Promise<Map<string, Folder>>;
}
