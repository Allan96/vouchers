import { ApiProperty } from '@nestjs/swagger';
import type { VoucherOutput } from '../../../application/dtos/voucher.output.js';
import type { VoucherRestriction } from '../../../domain/entities/voucher.js';

export class VoucherResponse {
  @ApiProperty({ format: 'uuid' })
  uuid: string;

  @ApiProperty({ example: 'WELCOME10' })
  code: string;

  @ApiProperty({ type: Number, example: 25.5 })
  value: number;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'Null means the voucher never expires',
    example: '2026-10-17T00:00:00.000Z',
  })
  validateDate: string | null;

  @ApiProperty({ description: 'Total uses allowed', example: 100 })
  limit: number;

  @ApiProperty({
    nullable: true,
    description: 'Uses allowed per user; null means no per-user limit',
    example: 1,
  })
  userLimit: number | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Free-form rules stored as JSONB',
    example: { categories: ['electronics'], minCartValue: 200 },
  })
  restriction: VoucherRestriction;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class VoucherPresenter {
  static toHttp(voucher: VoucherOutput): VoucherResponse {
    return {
      uuid: voucher.uuid,
      code: voucher.code,
      value: voucher.value,
      validateDate: voucher.validateDate?.toISOString() ?? null,
      limit: voucher.limit,
      userLimit: voucher.userLimit,
      restriction: voucher.restriction,
      createdAt: voucher.createdAt.toISOString(),
      updatedAt: voucher.updatedAt.toISOString(),
    };
  }
}
