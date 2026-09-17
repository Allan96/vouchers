import { Voucher } from '../../../domain/entities/voucher.js';
import { VoucherOrmEntity } from './voucher.orm-entity.js';

export class VoucherOrmMapper {
  static toDomain(row: VoucherOrmEntity): Voucher {
    return Voucher.restore({
      uuid: row.uuid,
      code: row.code,
      value: row.value,
      validateDate: row.validateDate,
      limit: row.limit,
      userLimit: row.userLimit,
      restriction: row.restriction ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  static toPersistence(voucher: Voucher): VoucherOrmEntity {
    const row = new VoucherOrmEntity();
    row.uuid = voucher.uuid;
    row.code = voucher.code;
    row.value = voucher.value;
    row.validateDate = voucher.validateDate;
    row.limit = voucher.limit;
    row.userLimit = voucher.userLimit;
    row.restriction = voucher.restriction;
    row.createdAt = voucher.createdAt;
    row.updatedAt = voucher.updatedAt;
    row.deletedAt = voucher.deletedAt;
    return row;
  }
}
