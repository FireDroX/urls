import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintToNumber } from '../../common/bigint-to-number.js';
import type { LINK_TYPES } from '../../common/variables.global.js';

export type LinkType = (typeof LINK_TYPES)[number];

@Entity('links')
@Index('UQ_links_public_id', ['publicId'], { unique: true })
@Index('IDX_links_type_created_at', ['type', 'createdAt'])
@Index('IDX_links_folder_id', ['folderId'])
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

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'expires_at',
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({
    type: 'int',
    unsigned: true,
    name: 'max_downloads',
    nullable: true,
  })
  maxDownloads: number | null;

  @Column({ type: 'int', unsigned: true, name: 'download_count', default: 0 })
  downloadCount: number;

  @Column({
    type: 'bigint',
    unsigned: true,
    name: 'max_total_bytes',
    nullable: true,
    transformer: bigintToNumber,
  })
  maxTotalBytes: number | null;

  @Column({ type: 'int', unsigned: true, name: 'max_files', nullable: true })
  maxFiles: number | null;

  @Column({ type: 'varchar', length: 36, name: 'folder_id', nullable: true })
  folderId: string | null;

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', precision: 6, nullable: true })
  deletedAt: Date | null;
}
