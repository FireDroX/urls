import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Tag } from './tag.entity.js';

@Entity('link_tags')
export class LinkTag {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'link_id' })
  linkId: string;

  @PrimaryColumn({ type: 'varchar', length: 36, name: 'tag_id' })
  tagId: string;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'tag_id',
    foreignKeyConstraintName: 'FK_link_tags_tag',
  })
  tag?: Tag;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}
