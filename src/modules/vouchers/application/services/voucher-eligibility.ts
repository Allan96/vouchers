import type { Voucher } from '../../domain/entities/voucher.js';
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
import { Voucher as VoucherEntity } from '../../domain/entities/voucher.js';

export interface EligibilityRequest {
  userId: string;
  categories: string[];
  code: string;
}

export interface EligibleVoucher {
  voucher: Voucher;
  userId: UserId;
  /** Usages already persisted in `users_vouchers` for this voucher. */
  usedCount: number;
}

/**
 * The rules that decide whether a voucher can be used by a user, shared by
 * `ValidateVoucherUseCase` (which only checks) and `UseVoucherUseCase` (which
 * checks and then consumes it), so both can never drift apart.
 */
export class VoucherEligibility {
  constructor(
    private readonly vouchers: VoucherRepository,
    private readonly usages: VoucherUsageRepository,
    private readonly reservations: VoucherReservationRepository,
  ) {}

  async check(
    request: EligibilityRequest,
    now: Date,
  ): Promise<EligibleVoucher> {
    const code = VoucherEntity.normalizeCode(request.code);
    const userId = UserId.create(request.userId);

    const voucher = await this.vouchers.findByCode(code);
    if (!voucher) {
      throw new VoucherNotFoundError(code);
    }

    if (voucher.isExpired(now)) {
      throw new VoucherNotAvailableError();
    }

    if (!voucher.isAvailableForCategories(request.categories)) {
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

    return { voucher, userId, usedCount: used };
  }
}
