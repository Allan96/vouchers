import { Injectable } from '@nestjs/common';
import type { VoucherUsage } from '../../../domain/entities/voucher-usage.js';
import type { Voucher } from '../../../domain/entities/voucher.js';
import {
  VoucherLimitReachedError,
  VoucherUserLimitReachedError,
} from '../../../domain/errors/voucher.errors.js';
import { VoucherUsageRepository } from '../../../domain/repositories/voucher-usage.repository.js';
import type { UserId } from '../../../domain/value-objects/user-id.js';

interface UsageRecord {
  userId: string;
  voucherUuid: string;
}

@Injectable()
export class InMemoryVoucherUsageRepository extends VoucherUsageRepository {
  private readonly usages: UsageRecord[] = [];

  /** Test/seed helper, outside of the port contract. */
  add(usage: UsageRecord): void {
    this.usages.push(usage);
  }

  async countByVoucher(voucherUuid: string): Promise<number> {
    return this.usages.filter((usage) => usage.voucherUuid === voucherUuid)
      .length;
  }

  async countByUserAndVoucher(
    userId: UserId,
    voucherUuid: string,
  ): Promise<number> {
    return this.usages.filter(
      (usage) =>
        usage.userId === userId.value && usage.voucherUuid === voucherUuid,
    ).length;
  }

  async saveWithinLimits(usage: VoucherUsage, voucher: Voucher): Promise<void> {
    const used = await this.countByVoucher(voucher.uuid);
    if (used >= voucher.limit) {
      throw new VoucherLimitReachedError(voucher.code, voucher.limit);
    }

    if (voucher.userLimit !== null) {
      const usedByUser = await this.countByUserAndVoucher(
        usage.userId,
        voucher.uuid,
      );
      if (usedByUser >= voucher.userLimit) {
        throw new VoucherUserLimitReachedError(voucher.code, voucher.userLimit);
      }
    }

    this.add({ userId: usage.userId.value, voucherUuid: usage.voucherUuid });
  }
}
