import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tags')
@Index('UQ_tags_public_id', ['publicId'], { unique: true })
@Index('UQ_tags_name', ['name'], { unique: true })
export class Tag {
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

  @Column({
    type: 'varchar',
    length: 50,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 7,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  color: string;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt: Date;
}
