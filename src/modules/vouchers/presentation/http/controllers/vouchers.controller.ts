import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponse } from '../../../../../shared/presentation/http/responses/error.response.js';
import { ListVouchersUseCase } from '../../../application/use-cases/list-vouchers.use-case.js';
import { UseVoucherUseCase } from '../../../application/use-cases/use-voucher.use-case.js';
import { ValidateVoucherUseCase } from '../../../application/use-cases/validate-voucher.use-case.js';
import {
  VoucherPresenter,
  VoucherResponse,
} from '../presenters/voucher.presenter.js';
import { UseVoucherRequest } from '../requests/use-voucher.request.js';
import { ValidateVoucherRequest } from '../requests/validate-voucher.request.js';

@ApiTags('vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly listVouchers: ListVouchersUseCase,
    private readonly validateVoucher: ValidateVoucherUseCase,
    private readonly useVoucher: UseVoucherUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List every voucher',
    description: 'Soft-deleted vouchers are not returned.',
  })
  @ApiOkResponse({ type: [VoucherResponse] })
  async getAll(): Promise<VoucherResponse[]> {
    const vouchers = await this.listVouchers.execute();
    return vouchers.map((voucher) => VoucherPresenter.toHttp(voucher));
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate a voucher for a user',
    description: [
      'Checks, in order: the voucher exists, it has not expired, it applies to',
      'the given categories, the total `limit` (persisted uses plus active',
      'holds from other users) and the per-user `userLimit`.',
      'A successful validation holds the voucher for that user for 15 minutes.',
    ].join(' '),
  })
  @ApiOkResponse({ type: VoucherResponse })
  @ApiBadRequestResponse({
    description: 'Malformed user_id or code',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Unknown code', type: ErrorResponse })
  @ApiConflictResponse({
    description:
      'Expired, not available for the categories, or limit/user_limit reached',
    type: ErrorResponse,
  })
  async validate(
    @Body() body: ValidateVoucherRequest,
  ): Promise<VoucherResponse> {
    const voucher = await this.validateVoucher.execute({
      userId: body?.user_id,
      categories: body?.categories ?? [],
      code: body?.code,
    });
    return VoucherPresenter.toHttp(voucher);
  }

  @Post('use')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Use a voucher',
    description: [
      'Runs the same checks as the validation and then consumes the voucher:',
      'the hold leaves Redis and a row is written to `users_vouchers`.',
      'Validating first is not required.',
    ].join(' '),
  })
  @ApiCreatedResponse({ type: VoucherResponse })
  @ApiBadRequestResponse({
    description: 'Malformed user_id or code',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({ description: 'Unknown code', type: ErrorResponse })
  @ApiConflictResponse({
    description:
      'Expired, not available for the categories, or limit/user_limit reached',
    type: ErrorResponse,
  })
  async use(@Body() body: UseVoucherRequest): Promise<VoucherResponse> {
    const voucher = await this.useVoucher.execute({
      userId: body?.user_id,
      categories: body?.categories ?? [],
      code: body?.code,
    });
    return VoucherPresenter.toHttp(voucher);
  }
}
