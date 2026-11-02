import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { LINK_TYPES } from '../../common/variables.global.js';

export type LinkType = (typeof LINK_TYPES)[number];

@Entity('links')
@Index('UQ_links_public_id', ['publicId'], { unique: true })
@Index('IDX_links_type_created_at', ['type', 'createdAt'])
export class Link {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'public_id',
    charset: 'utf8mb4',
    collation: 'utf8mb4_bin',
  })
  publicId: string;

  @Column({ type: 'varchar', length: 16 })
  type: LinkType;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  destination: string | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'expires_at',
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', precision: 6, nullable: true })
  deletedAt: Date | null;
}
