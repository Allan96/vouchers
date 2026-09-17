import { Injectable } from '@nestjs/common';
import type { Voucher } from '../../../domain/entities/voucher.js';
import { VoucherRepository } from '../../../domain/repositories/voucher.repository.js';

@Injectable()
export class InMemoryVoucherRepository extends VoucherRepository {
  private readonly vouchers: Voucher[] = [];

  /** Test/seed helper, outside of the port contract. */
  add(voucher: Voucher): void {
    this.vouchers.push(voucher);
  }

  async findAll(): Promise<Voucher[]> {
    return this.vouchers.filter((voucher) => voucher.deletedAt === null);
  }

  async findByCode(code: string): Promise<Voucher | null> {
    const found = await this.findAll();
    return found.find((voucher) => voucher.code === code) ?? null;
  }
}
