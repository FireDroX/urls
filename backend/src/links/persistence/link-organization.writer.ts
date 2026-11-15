import type { EntityManager } from 'typeorm';
import {
  isDuplicateEntry,
  isForeignKeyViolation,
} from '../../common/database-errors.js';
import { FolderNotFoundException } from '../../common/exceptions/folders/folder-not-found.exception.js';
import { SlugAlreadyTakenException } from '../../common/exceptions/links/slug-already-taken.exception.js';
import { TagNotFoundException } from '../../common/exceptions/tags/tag-not-found.exception.js';
import { LinkTag } from '../../tags/entities/link-tag.entity.js';
import { Link } from '../entities/link.entity.js';
import type { ResolvedOrganization } from '../link-organization.js';

const TAG_CONSTRAINT = 'FK_link_tags_tag';
const FOLDER_CONSTRAINT = 'FK_links_folder';

export async function saveWithOrganization(
  manager: EntityManager,
  link: Link,
  organization: ResolvedOrganization,
): Promise<Link> {
  if (organization.folderId !== undefined) {
    link.folderId = organization.folderId;
  }
  try {
    const saved = await manager.save(Link, link);
    if (organization.tagIds !== undefined) {
      await manager.delete(LinkTag, { linkId: saved.id });
      if (organization.tagIds.length > 0) {
        await manager.insert(
          LinkTag,
          organization.tagIds.map((tagId) => ({ linkId: saved.id, tagId })),
        );
      }
    }
    return saved;
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new SlugAlreadyTakenException();
    }
    if (isForeignKeyViolation(error, TAG_CONSTRAINT)) {
      throw new TagNotFoundException();
    }
    if (isForeignKeyViolation(error, FOLDER_CONSTRAINT)) {
      throw new FolderNotFoundException();
    }
    throw error;
  }
}
