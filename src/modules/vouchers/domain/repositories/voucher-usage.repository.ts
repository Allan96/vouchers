import type { VoucherUsage } from '../entities/voucher-usage.js';
import type { Voucher } from '../entities/voucher.js';
import type { UserId } from '../value-objects/user-id.js';

export abstract class VoucherUsageRepository {
  /** How many times a voucher was used, by every user. */
  abstract countByVoucher(voucherUuid: string): Promise<number>;

  /** How many times a user already used a given voucher. */
  abstract countByUserAndVoucher(
    userId: UserId,
    voucherUuid: string,
  ): Promise<number>;

  /**
   * Records a usage atomically with the limit check, so `limit` and
   * `user_limit` hold under concurrency. Throws `VoucherLimitReachedError` or
   * `VoucherUserLimitReachedError` when the write would exceed them.
   */
  abstract saveWithinLimits(
    usage: VoucherUsage,
    voucher: Voucher,
  ): Promise<void>;
}
