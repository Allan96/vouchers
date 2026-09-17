import { ApiProperty } from '@nestjs/swagger';

/** The HTTP contract uses snake_case; the mapping to the use case input is
 * done by the controller. */
export class ValidateVoucherRequest {
  @ApiProperty({
    format: 'uuid',
    example: '3f1c5e0a-2b3d-4c5e-8f90-123456789abc',
  })
  user_id: string;

  @ApiProperty({
    type: [String],
    description:
      'Cart categories. The voucher applies when at least one of them is in restriction.categories.',
    example: ['electronics', 'games'],
  })
  categories: string[];

  @ApiProperty({
    description: 'Case-insensitive voucher code',
    example: 'WELCOME10',
  })
  code: string;
}
