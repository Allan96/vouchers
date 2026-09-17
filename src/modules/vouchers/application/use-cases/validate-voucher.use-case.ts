import type { UseCase } from '../../../../shared/application/use-case.js';
import { VoucherReservation } from '../../domain/entities/voucher-reservation.js';
import { Voucher } from '../../domain/entities/voucher.js';
import {
  VoucherLimitReachedError,
  VoucherNotAvailableError,
  VoucherNotAvailableForCategoriesError,
  VoucherNotFoundError,
  VoucherUserLimitReachedError,
} from '../../domain/errors/voucher.errors.js';
import type { VoucherReservationRepository } from '../../domain/repositories/voucher-reservation.repository.js';
import type { VoucherUsageRepository } from '../../domain/repositories/voucher-usage.repository.js';
import type { VoucherRepository } from '../../domain/repositories/voucher.repository.js';
import { UserId } from '../../domain/value-objects/user-id.js';
import type { Clock } from '../ports/clock.js';
import type { ValidateVoucherInput } from '../dtos/validate-voucher.input.js';
import { toVoucherOutput, type VoucherOutput } from '../dtos/voucher.output.js';

/**
 * Resolves the voucher by code and checks, in order: expiry, the
 * `restriction.categories` against the incoming `categories`, the total `limit`
 * and the per-user `userLimit`.
 *
 * A successful validation holds the voucher for the user (see
 * `VoucherReservation`). Active holds from other users count as temporarily
 * used against the total limit.
 */
export class ValidateVoucherUseCase implements UseCase<
  ValidateVoucherInput,
  VoucherOutput
> {
  constructor(
    private readonly vouchers: VoucherRepository,
    private readonly usages: VoucherUsageRepository,
    private readonly reservations: VoucherReservationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ValidateVoucherInput): Promise<VoucherOutput> {
    const now = this.clock.now();
    const code = Voucher.normalizeCode(input.code);
    const userId = UserId.create(input.userId);

    const voucher = await this.vouchers.findByCode(code);
    if (!voucher) {
      throw new VoucherNotFoundError(code);
    }

    if (voucher.isExpired(now)) {
      throw new VoucherNotAvailableError();
    }

    if (!voucher.isAvailableForCategories(input.categories)) {
      throw new VoucherNotAvailableForCategoriesError(voucher.code);
    }

    const used = await this.usages.countByVoucher(voucher.uuid);

    const reserved = await this.reservations.countActiveByCodeExcludingUser(
      voucher.code,
      userId,
      now,
    );
    if (used + reserved >= voucher.limit) {
      throw new VoucherLimitReachedError(voucher.code, voucher.limit);
    }

    if (voucher.userLimit !== null) {
      const usedByUser = await this.usages.countByUserAndVoucher(
        userId,
        voucher.uuid,
      );
      if (usedByUser >= voucher.userLimit) {
        throw new VoucherUserLimitReachedError(voucher.code, voucher.userLimit);
      }
    }

    await this.reserveFor(userId, voucher.code, now);

    return toVoucherOutput(voucher);
  }

  /**
   * The hold is only pushed forward once the previous one expired, so a user
   * revalidating within the window keeps the original `expireDate`.
   */
  private async reserveFor(
    userId: UserId,
    code: string,
    now: Date,
  ): Promise<void> {
    const active = await this.reservations.findActiveByUserAndCode(
      userId,
      code,
      now,
    );
    if (active) {
      return;
    }

    await this.reservations.save(VoucherReservation.create(userId, code, now));
  }
}
