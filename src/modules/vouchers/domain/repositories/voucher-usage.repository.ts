import type { UserId } from '../value-objects/user-id.js';

export abstract class VoucherUsageRepository {
  /** How many times a voucher was used, by every user. */
  abstract countByVoucher(voucherUuid: string): Promise<number>;

  /** How many times a user already used a given voucher. */
  abstract countByUserAndVoucher(
    userId: UserId,
    voucherUuid: string,
  ): Promise<number>;
}
