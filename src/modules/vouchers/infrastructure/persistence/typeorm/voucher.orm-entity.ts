import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { VoucherRestriction } from '../../../domain/entities/voucher.js';

/** Postgres returns `numeric` as string, so it is converted on read. */
const numericTransformer = {
  to: (value: number): number => value,
  from: (value: string | null): number => (value === null ? 0 : Number(value)),
};

@Entity('vouchers')
export class VoucherOrmEntity {
  @PrimaryColumn('uuid')
  uuid: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  value: number;

  @Column({ type: 'timestamptz', name: 'validate_date', nullable: true })
  validateDate: Date | null;

  @Column({ type: 'integer' })
  limit: number;

  @Column({ type: 'integer', name: 'user_limit', nullable: true })
  userLimit: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  restriction: VoucherRestriction;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
