import type { UseCase } from '../../../../shared/application/use-case.js';
import type { VoucherRepository } from '../../domain/repositories/voucher.repository.js';
import { toVoucherOutput, type VoucherOutput } from '../dtos/voucher.output.js';

export class ListVouchersUseCase implements UseCase<void, VoucherOutput[]> {
  constructor(private readonly vouchers: VoucherRepository) {}

  async execute(): Promise<VoucherOutput[]> {
    const vouchers = await this.vouchers.findAll();
    return vouchers.map(toVoucherOutput);
  }
}
