import type { UseCase } from '../../../../shared/application/use-case.js';
import { VoucherUsage } from '../../domain/entities/voucher-usage.js';
import type { VoucherReservationRepository } from '../../domain/repositories/voucher-reservation.repository.js';
import type { VoucherUsageRepository } from '../../domain/repositories/voucher-usage.repository.js';
import type { UseVoucherInput } from '../dtos/use-voucher.input.js';
import { toVoucherOutput, type VoucherOutput } from '../dtos/voucher.output.js';
import type { Clock } from '../ports/clock.js';
import type { VoucherEligibility } from '../services/voucher-eligibility.js';

/**
 * Consumes the voucher: it runs the same checks as the validation and then the
 * hold leaves Redis and becomes a row in `users_vouchers`. The write itself is
 * guarded by the repository, which re-checks the limits inside the transaction.
 *
 * A previous validation is not required — a user that never held the voucher
 * can use it directly, as long as the rules allow.
 */
export class UseVoucherUseCase implements UseCase<
  UseVoucherInput,
  VoucherOutput
> {
  constructor(
    private readonly eligibility: VoucherEligibility,
    private readonly usages: VoucherUsageRepository,
    private readonly reservations: VoucherReservationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UseVoucherInput): Promise<VoucherOutput> {
    const now = this.clock.now();
    const { voucher, userId } = await this.eligibility.check(input, now);

    // The check inside `saveWithinLimits` is the authoritative one: it runs in
    // the same transaction as the insert, so the limit holds under concurrency.
    await this.usages.saveWithinLimits(
      VoucherUsage.create(userId, voucher.uuid, now),
      voucher,
    );
    await this.reservations.remove(userId, voucher.code);

    return toVoucherOutput(voucher);
  }
}
