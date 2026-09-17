import type { UseCase } from '../../../../shared/application/use-case.js';
import { VoucherLimitReachedError } from '../../domain/errors/voucher.errors.js';
import type { VoucherReservationRepository } from '../../domain/repositories/voucher-reservation.repository.js';
import type { ValidateVoucherInput } from '../dtos/validate-voucher.input.js';
import { toVoucherOutput, type VoucherOutput } from '../dtos/voucher.output.js';
import type { Clock } from '../ports/clock.js';
import type { VoucherEligibility } from '../services/voucher-eligibility.js';

/**
 * Checks whether the voucher can be used (see `VoucherEligibility`) and holds
 * it for the user, without consuming it.
 */
export class ValidateVoucherUseCase implements UseCase<
  ValidateVoucherInput,
  VoucherOutput
> {
  constructor(
    private readonly eligibility: VoucherEligibility,
    private readonly reservations: VoucherReservationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ValidateVoucherInput): Promise<VoucherOutput> {
    const now = this.clock.now();
    const { voucher, userId, usedCount } = await this.eligibility.check(
      input,
      now,
    );

    // Taking the hold is what actually enforces the total limit here: the store
    // counts the active holds and takes one atomically, so two concurrent
    // validations on the last unit cannot both win. The hold of a user that
    // already has one keeps its original expireDate.
    const reservation = await this.reservations.reserve(
      userId,
      voucher.code,
      now,
      voucher.limit - usedCount,
    );
    if (!reservation) {
      throw new VoucherLimitReachedError(voucher.code, voucher.limit);
    }

    return toVoucherOutput(voucher);
  }
}
