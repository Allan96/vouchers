import { ApiProperty } from '@nestjs/swagger';

/** Shape produced by `DomainErrorFilter` for every domain error. */
export class ErrorResponse {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({
    description: 'Domain error class name',
    example: 'VoucherLimitReachedError',
  })
  error: string;

  @ApiProperty({ example: 'O voucher não está mais disponivel' })
  message: string;
}
