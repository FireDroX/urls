import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type {
  LinkCheckErrorKind,
  LinkCheckOutcome,
} from '../../common/variables.global.js';
import { Link } from './link.entity.js';

@Entity('link_checks')
export class LinkCheck {
  @PrimaryColumn({ name: 'link_id', type: 'varchar', length: 36 })
  linkId: string;

  @OneToOne(() => Link, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'link_id',
    foreignKeyConstraintName: 'FK_link_checks_link',
  })
  link?: Link;

  @Column({ type: 'varchar', length: 16 })
  outcome: LinkCheckOutcome;

  @Column({
    type: 'smallint',
    unsigned: true,
    name: 'status_code',
    nullable: true,
  })
  statusCode: number | null;

  @Column({ type: 'varchar', length: 32, name: 'error_kind', nullable: true })
  errorKind: LinkCheckErrorKind | null;

  @Column({ type: 'int', unsigned: true, name: 'consecutive_failures' })
  consecutiveFailures: number;

  @Column({ type: 'datetime', precision: 6, name: 'checked_at' })
  checkedAt: Date;
}
