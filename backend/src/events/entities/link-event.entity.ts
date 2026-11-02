import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EVENT_TYPES } from '../../common/variables.global.js';
import { Link } from '../../links/entities/link.entity.js';

export type EventType = (typeof EVENT_TYPES)[number];

@Entity('events')
@Index('IDX_events_link_id_created_at', ['linkId', 'createdAt'])
export class LinkEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'link_id' })
  linkId: string;

  @ManyToOne(() => Link, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'link_id', foreignKeyConstraintName: 'FK_events_link' })
  link?: Link;

  @Column({ type: 'varchar', length: 16 })
  type: EventType;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  referer: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'referer_host',
    nullable: true,
  })
  refererHost: string | null;

  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'char', length: 2, nullable: true })
  country: string | null;

  @Column({ type: 'char', length: 64, name: 'ip_hash', nullable: true })
  ipHash: string | null;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}
