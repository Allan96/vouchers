import type { UserId } from '../value-objects/user-id.js';

/** How long a validated voucher stays reserved for the user. */
export const RESERVATION_TTL_MINUTES = 15;

/**
 * Temporary hold created when a user validates a voucher. It is not a usage
 * yet, but it counts against the voucher total limit while it is active.
 */
export class VoucherReservation {
  private constructor(
    readonly userId: UserId,
    readonly code: string,
    readonly expireDate: Date,
  ) {}

  static create(userId: UserId, code: string, now: Date): VoucherReservation {
    return new VoucherReservation(
      userId,
      code,
      new Date(now.getTime() + RESERVATION_TTL_MINUTES * 60_000),
    );
  }

  /** Rebuilds a hold read back from the store. */
  static restore(
    userId: UserId,
    code: string,
    expireDate: Date,
  ): VoucherReservation {
    return new VoucherReservation(userId, code, expireDate);
  }

  isActive(now: Date): boolean {
    return this.expireDate.getTime() > now.getTime();
  }
}
