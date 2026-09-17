import type { Voucher } from '../entities/voucher.js';

export abstract class VoucherRepository {
  /** Returns the vouchers that were not soft-deleted. */
  abstract findAll(): Promise<Voucher[]>;

  /** Looks a voucher up by its normalized code. */
  abstract findByCode(code: string): Promise<Voucher | null>;
}
