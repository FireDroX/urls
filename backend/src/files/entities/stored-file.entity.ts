import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintToNumber } from '../../common/bigint-to-number.js';
import {
  DROP_UPLOADER_NAME_MAX_LENGTH,
  type FILE_STATUSES,
} from '../../common/variables.global.js';
import { Link } from '../../links/entities/link.entity.js';

export type FileStatus = (typeof FILE_STATUSES)[number];

@Entity('files')
@Index('UQ_files_public_id', ['publicId'], { unique: true })
@Index('UQ_files_s3_key', ['s3Key'], { unique: true })
@Index('IDX_files_link_id', ['linkId'])
@Index('IDX_files_status_created_at', ['status', 'createdAt'])
export class StoredFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 16,
    name: 'public_id',
    charset: 'utf8mb4',
    collation: 'utf8mb4_bin',
  })
  publicId: string;

  @Column({ type: 'varchar', length: 36, name: 'link_id' })
  linkId: string;

  @ManyToOne(() => Link, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'link_id', foreignKeyConstraintName: 'FK_files_link' })
  link?: Link;

  @Column({
    type: 'varchar',
    length: 255,
    name: 's3_key',
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  s3Key: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    length: DROP_UPLOADER_NAME_MAX_LENGTH,
    name: 'uploader_name',
    nullable: true,
  })
  uploaderName: string | null;

  @Column({ type: 'bigint', unsigned: true, transformer: bigintToNumber })
  size: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mime: string | null;

  @Column({
    type: 'char',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  sha256: string;

  @Column({ type: 'varchar', length: 16 })
  status: FileStatus;

  @Column({
    type: 'varchar',
    length: 1024,
    name: 'upload_id',
    nullable: true,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  uploadId: string | null;

  @Column({
    type: 'char',
    length: 64,
    name: 'upload_token_hash',
    nullable: true,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  uploadTokenHash: string | null;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'completed_at',
    nullable: true,
  })
  completedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at', precision: 6, nullable: true })
  deletedAt: Date | null;
}
