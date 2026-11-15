import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isDuplicateEntry } from '../../common/database-errors.js';
import { TagNameAlreadyTakenException } from '../../common/exceptions/tags/tag-name-already-taken.exception.js';
import { TagPublicIdTakenException } from '../../common/exceptions/tags/tag-public-id-taken.exception.js';
import { Tag } from '../entities/tag.entity.js';
import type {
  NewTag,
  TagRepository,
  TagWithLinkCount,
} from './tag.repository.js';

const NAME_INDEX = 'UQ_tags_name_key';

@Injectable()
export class TypeormTagRepository implements TagRepository {
  constructor(
    @InjectRepository(Tag)
    private readonly repository: Repository<Tag>,
  ) {}

  async listWithLinkCounts(): Promise<TagWithLinkCount[]> {
    const { entities, raw } = await this.repository
      .createQueryBuilder('tag')
      .leftJoin('link_tags', 'link_tag', 'link_tag.tag_id = tag.id')
      .leftJoin(
        'links',
        'link',
        'link.id = link_tag.link_id AND link.deleted_at IS NULL',
      )
      .addSelect('COUNT(link.id)', 'linkCount')
      .groupBy('tag.id')
      .orderBy('tag.name', 'ASC')
      .getRawAndEntities<{ linkCount: string }>();
    return entities.map((tag, index) => ({
      tag,
      linkCount: Number(raw[index].linkCount),
    }));
  }

  async countLinks(tagId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('tag')
      .leftJoin('link_tags', 'link_tag', 'link_tag.tag_id = tag.id')
      .leftJoin(
        'links',
        'link',
        'link.id = link_tag.link_id AND link.deleted_at IS NULL',
      )
      .select('COUNT(link.id)', 'linkCount')
      .where('tag.id = :tagId', { tagId })
      .getRawOne<{ linkCount: string }>();
    return Number(row?.linkCount ?? 0);
  }

  findByPublicId(publicId: string): Promise<Tag | null> {
    return this.repository.findOneBy({ publicId });
  }

  findByPublicIds(publicIds: string[]): Promise<Tag[]> {
    return this.repository.findBy({ publicId: In(publicIds) });
  }

  findByNameKey(nameKey: string): Promise<Tag | null> {
    return this.repository.findOneBy({ nameKey });
  }

  insert(tag: NewTag): Promise<Tag> {
    return this.persist(this.repository.create(tag));
  }

  save(tag: Tag): Promise<Tag> {
    return this.persist(tag);
  }

  async remove(tag: Tag): Promise<void> {
    await this.repository.delete({ id: tag.id });
  }

  private async persist(tag: Tag): Promise<Tag> {
    try {
      return await this.repository.save(tag);
    } catch (error) {
      if (isDuplicateEntry(error)) {
        const message = String(
          (error as { driverError?: { sqlMessage?: string } }).driverError
            ?.sqlMessage ?? '',
        );
        throw message.includes(NAME_INDEX)
          ? new TagNameAlreadyTakenException()
          : new TagPublicIdTakenException();
      }
      throw error;
    }
  }
}
