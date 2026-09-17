import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { VoucherUsage } from '../../../domain/entities/voucher-usage.js';
import type { Voucher } from '../../../domain/entities/voucher.js';
import {
  VoucherLimitReachedError,
  VoucherUserLimitReachedError,
} from '../../../domain/errors/voucher.errors.js';
import { VoucherUsageRepository } from '../../../domain/repositories/voucher-usage.repository.js';
import type { UserId } from '../../../domain/value-objects/user-id.js';
import { VoucherUsageOrmEntity } from './voucher-usage.orm-entity.js';

@Injectable()
export class TypeOrmVoucherUsageRepository extends VoucherUsageRepository {
  constructor(
    @InjectRepository(VoucherUsageOrmEntity)
    private readonly usages: Repository<VoucherUsageOrmEntity>,
  ) {
    super();
  }

  async countByVoucher(voucherUuid: string): Promise<number> {
    return this.usages.countBy({ voucherId: voucherUuid });
  }

  async countByUserAndVoucher(
    userId: UserId,
    voucherUuid: string,
  ): Promise<number> {
    return this.usages.countBy({
      userId: userId.value,
      voucherId: voucherUuid,
    });
  }

  /**
   * Counting and inserting have to be one operation, otherwise two concurrent
   * requests on the last unit would both pass the check and the voucher would
   * be used beyond its limit. `SELECT ... FOR UPDATE` on the voucher row makes
   * every use of the same voucher serialize behind that lock, so the count is
   * taken against a state nobody else can change until this transaction ends.
   */
  async saveWithinLimits(usage: VoucherUsage, voucher: Voucher): Promise<void> {
    await this.usages.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT 1 FROM "vouchers" WHERE "uuid" = $1 FOR UPDATE',
        [voucher.uuid],
      );

      const used = await manager.countBy(VoucherUsageOrmEntity, {
        voucherId: voucher.uuid,
      });
      if (used >= voucher.limit) {
        throw new VoucherLimitReachedError(voucher.code, voucher.limit);
      }

      if (voucher.userLimit !== null) {
        const usedByUser = await manager.countBy(VoucherUsageOrmEntity, {
          voucherId: voucher.uuid,
          userId: usage.userId.value,
        });
        if (usedByUser >= voucher.userLimit) {
          throw new VoucherUserLimitReachedError(
            voucher.code,
            voucher.userLimit,
          );
        }
      }

      await manager.insert(VoucherUsageOrmEntity, {
        userId: usage.userId.value,
        voucherId: usage.voucherUuid,
        createdAt: usage.usedAt,
      });
    });
  }
}
