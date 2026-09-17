import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Voucher } from '../../../domain/entities/voucher.js';
import { VoucherRepository } from '../../../domain/repositories/voucher.repository.js';
import { VoucherOrmEntity } from './voucher.orm-entity.js';
import { VoucherOrmMapper } from './voucher.orm-mapper.js';

@Injectable()
export class TypeOrmVoucherRepository extends VoucherRepository {
  constructor(
    @InjectRepository(VoucherOrmEntity)
    private readonly vouchers: Repository<VoucherOrmEntity>,
  ) {
    super();
  }

  async findAll(): Promise<Voucher[]> {
    // Rows with `deleted_at` are filtered out by the soft-delete column.
    const rows = await this.vouchers.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => VoucherOrmMapper.toDomain(row));
  }

  async findByCode(code: string): Promise<Voucher | null> {
    const row = await this.vouchers.findOne({ where: { code } });
    return row ? VoucherOrmMapper.toDomain(row) : null;
  }
}
