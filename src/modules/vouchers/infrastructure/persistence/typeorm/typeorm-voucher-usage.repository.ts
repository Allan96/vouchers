import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
