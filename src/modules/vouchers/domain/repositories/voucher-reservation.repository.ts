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

  abstract save(reservation: VoucherReservation): Promise<void>;
}
