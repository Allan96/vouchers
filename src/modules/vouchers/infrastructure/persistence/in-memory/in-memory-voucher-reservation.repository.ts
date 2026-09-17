import { Injectable } from '@nestjs/common';
import type { VoucherReservation } from '../../../domain/entities/voucher-reservation.js';
import { VoucherReservationRepository } from '../../../domain/repositories/voucher-reservation.repository.js';
import type { UserId } from '../../../domain/value-objects/user-id.js';

/**
 * Reservations live in memory on purpose: they are short-lived holds, not
 * usages. They are lost on restart and are NOT shared between instances.
 */
@Injectable()
export class InMemoryVoucherReservationRepository extends VoucherReservationRepository {
  private readonly reservations = new Map<string, VoucherReservation>();

  async findActiveByUserAndCode(
    userId: UserId,
    code: string,
    now: Date,
  ): Promise<VoucherReservation | null> {
    this.prune(now);
    const reservation = this.reservations.get(this.key(userId, code));
    return reservation?.isActive(now) ? reservation : null;
  }

  async countActiveByCodeExcludingUser(
    code: string,
    userId: UserId,
    now: Date,
  ): Promise<number> {
    this.prune(now);
    const own = this.key(userId, code);

    let count = 0;
    for (const [key, reservation] of this.reservations) {
      if (
        key !== own &&
        reservation.code === code &&
        reservation.isActive(now)
      ) {
        count += 1;
      }
    }
    return count;
  }

  async save(reservation: VoucherReservation): Promise<void> {
    this.reservations.set(
      this.key(reservation.userId, reservation.code),
      reservation,
    );
  }

  /** Test helper, outside of the port contract. */
  clear(): void {
    this.reservations.clear();
  }

  private key(userId: UserId, code: string): string {
    return `${userId.value}|${code}`;
  }

  /** Expired holds are dropped lazily, so the map does not grow forever. */
  private prune(now: Date): void {
    for (const [key, reservation] of this.reservations) {
      if (!reservation.isActive(now)) {
        this.reservations.delete(key);
      }
    }
  }
}
