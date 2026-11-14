import type { Tag } from '../entities/tag.entity.js';

export type NewTag = Pick<Tag, 'publicId' | 'name' | 'color'>;

export interface TagWithLinkCount {
  tag: Tag;
  linkCount: number;
}

export interface TagRepository {
  listWithLinkCounts(): Promise<TagWithLinkCount[]>;
  countLinks(tagId: string): Promise<number>;
  findByPublicId(publicId: string): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  insert(tag: NewTag): Promise<Tag>;
  save(tag: Tag): Promise<Tag>;
  remove(tag: Tag): Promise<void>;
}
