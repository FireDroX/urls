import { Inject, Injectable } from '@nestjs/common';
import { FoldersService } from '../../folders/services/folders.service.js';
import { TagsService } from '../../tags/services/tags.service.js';
import type { Link } from '../entities/link.entity.js';
import {
  EMPTY_LINK_ORGANIZATION,
  type LinkOrganization,
  type OrganizationInput,
  type ResolvedOrganization,
} from '../link-organization.js';
import type { LinkOrganizationRepository } from '../persistence/link-organization.repository.js';

@Injectable()
export class LinkOrganizationService {
  constructor(
    @Inject('LinkOrganizationsRepository')
    private readonly repository: LinkOrganizationRepository,
    private readonly tags: TagsService,
    private readonly folders: FoldersService,
  ) {}

  async resolve(input: OrganizationInput): Promise<ResolvedOrganization> {
    const resolved: ResolvedOrganization = {};
    if (input.tagIds !== undefined) {
      const tags = await this.tags.findAllByPublicIds(input.tagIds);
      resolved.tagIds = tags.map((tag) => tag.id);
    }
    if (input.folderId !== undefined) {
      resolved.folderId =
        input.folderId === null
          ? null
          : (await this.folders.findByPublicId(input.folderId)).id;
    }
    return resolved;
  }

  async loadFor(links: Link[]): Promise<Map<string, LinkOrganization>> {
    const folderIds = [
      ...new Set(
        links.flatMap((link) => (link.folderId ? [link.folderId] : [])),
      ),
    ];
    const [tagsByLink, foldersById] = await Promise.all([
      this.repository.findTagsByLinkIds(links.map((link) => link.id)),
      this.repository.findFoldersByIds(folderIds),
    ]);
    return new Map(
      links.map((link) => [
        link.id,
        {
          tags: tagsByLink.get(link.id) ?? [],
          folder: link.folderId
            ? (foldersById.get(link.folderId) ?? null)
            : null,
        },
      ]),
    );
  }

  async loadOne(link: Link): Promise<LinkOrganization> {
    const loaded = await this.loadFor([link]);
    return loaded.get(link.id) ?? EMPTY_LINK_ORGANIZATION;
  }
}
