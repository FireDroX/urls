import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('folders')
@Index('UQ_folders_public_id', ['publicId'], { unique: true })
@Index('UQ_folders_name_key', ['nameKey'], { unique: true })
export class Folder {
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
    length: 100,
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'name_key',
    charset: 'utf8mb4',
    collation: 'utf8mb4_bin',
  })
  nameKey: string;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', precision: 6 })
  updatedAt: Date;
}
