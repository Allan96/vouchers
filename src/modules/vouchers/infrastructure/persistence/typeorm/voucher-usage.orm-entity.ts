import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Usage log of a voucher by a user. The surrogate `uuid` exists because a user
 * may use the same voucher more than once when `user_limit` is greater than 1,
 * so (user_id, voucher_id) cannot be the primary key.
 */
@Entity('users_vouchers')
@Index(['userId', 'voucherId'])
export class VoucherUsageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'voucher_id' })
  voucherId: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
