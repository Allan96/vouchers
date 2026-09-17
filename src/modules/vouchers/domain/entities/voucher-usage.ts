import type { UserId } from '../value-objects/user-id.js';

/** A voucher that was actually used by a user — the persisted counterpart of a
 * `VoucherReservation`. */
export class VoucherUsage {
  private constructor(
    readonly userId: UserId,
    readonly voucherUuid: string,
    readonly usedAt: Date,
  ) {}

  static create(userId: UserId, voucherUuid: string, now: Date): VoucherUsage {
    return new VoucherUsage(userId, voucherUuid, now);
  }
}
