import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Folder } from '../../folders/entities/folder.entity.js';
import { LinkTag } from '../../tags/entities/link-tag.entity.js';
import type { Tag } from '../../tags/entities/tag.entity.js';
import type { LinkOrganizationRepository } from './link-organization.repository.js';

@Injectable()
export class TypeormLinkOrganizationRepository implements LinkOrganizationRepository {
  constructor(
    @InjectRepository(LinkTag)
    private readonly linkTags: Repository<LinkTag>,
    @InjectRepository(Folder)
    private readonly folders: Repository<Folder>,
  ) {}

  async findTagsByLinkIds(linkIds: string[]): Promise<Map<string, Tag[]>> {
    const tagsByLink = new Map<string, Tag[]>();
    if (linkIds.length === 0) {
      return tagsByLink;
    }
    const rows = await this.linkTags.find({
      where: { linkId: In(linkIds) },
      relations: { tag: true },
      order: { tag: { name: 'ASC' } },
    });
    for (const { linkId, tag } of rows) {
      if (!tag) continue;
      tagsByLink.set(linkId, [...(tagsByLink.get(linkId) ?? []), tag]);
    }
    return tagsByLink;
  }

  async findFoldersByIds(folderIds: string[]): Promise<Map<string, Folder>> {
    if (folderIds.length === 0) {
      return new Map();
    }
    const folders = await this.folders.findBy({ id: In(folderIds) });
    return new Map(folders.map((folder) => [folder.id, folder]));
  }
}
