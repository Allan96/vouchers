import { Injectable } from '@nestjs/common';
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
}
