import type { VoucherReservation } from '../entities/voucher-reservation.js';
import type { UserId } from '../value-objects/user-id.js';

export abstract class VoucherReservationRepository {
  /** The user's own hold, or null when it never existed or already expired. */
  abstract findActiveByUserAndCode(
    userId: UserId,
    code: string,
    now: Date,
  ): Promise<VoucherReservation | null>;

  /**
   * Active holds of a voucher by *other* users. The requesting user's own hold
   * is excluded, otherwise it would count against them on the next validation.
   */
  abstract countActiveByCodeExcludingUser(
    code: string,
    userId: UserId,
    now: Date,
  ): Promise<number>;

  /**
   * Takes a hold for the user, atomically with the check against
   * `maxActiveHolds`. Returns the hold the user now has — an existing one keeps
   * its original `expireDate` — or `null` when there is no slot left.
   */
  abstract reserve(
    userId: UserId,
    code: string,
    now: Date,
    maxActiveHolds: number,
  ): Promise<VoucherReservation | null>;

  /** Releases the user's hold. Idempotent: removing what is not there is fine. */
  abstract remove(userId: UserId, code: string): Promise<void>;
}
