import type {
  Voucher,
  VoucherRestriction,
} from '../../domain/entities/voucher.js';

export interface VoucherOutput {
  uuid: string;
  code: string;
  value: number;
  validateDate: Date | null;
  limit: number;
  userLimit: number | null;
  restriction: VoucherRestriction;
  createdAt: Date;
  updatedAt: Date;
}

export const toVoucherOutput = (voucher: Voucher): VoucherOutput => ({
  uuid: voucher.uuid,
  code: voucher.code,
  value: voucher.value,
  validateDate: voucher.validateDate,
  limit: voucher.limit,
  userLimit: voucher.userLimit,
  restriction: voucher.restriction,
  createdAt: voucher.createdAt,
  updatedAt: voucher.updatedAt,
});
