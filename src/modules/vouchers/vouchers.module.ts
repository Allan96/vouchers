import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../shared/infrastructure/cache/redis.module.js';
import { ListVouchersUseCase } from './application/use-cases/list-vouchers.use-case.js';
import { UseVoucherUseCase } from './application/use-cases/use-voucher.use-case.js';
import { ValidateVoucherUseCase } from './application/use-cases/validate-voucher.use-case.js';
import { VoucherEligibility } from './application/services/voucher-eligibility.js';
import { Clock } from './application/ports/clock.js';
import { VoucherReservationRepository } from './domain/repositories/voucher-reservation.repository.js';
import { VoucherUsageRepository } from './domain/repositories/voucher-usage.repository.js';
import { VoucherRepository } from './domain/repositories/voucher.repository.js';
import { RedisVoucherReservationRepository } from './infrastructure/persistence/redis/redis-voucher-reservation.repository.js';
import { TypeOrmVoucherUsageRepository } from './infrastructure/persistence/typeorm/typeorm-voucher-usage.repository.js';
import { TypeOrmVoucherRepository } from './infrastructure/persistence/typeorm/typeorm-voucher.repository.js';
import { VoucherUsageOrmEntity } from './infrastructure/persistence/typeorm/voucher-usage.orm-entity.js';
import { VoucherOrmEntity } from './infrastructure/persistence/typeorm/voucher.orm-entity.js';
import { SystemClock } from './infrastructure/services/system-clock.js';
import { VouchersController } from './presentation/http/controllers/vouchers.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoucherOrmEntity, VoucherUsageOrmEntity]),
    RedisModule,
  ],
  controllers: [VouchersController],
  providers: [
    { provide: VoucherRepository, useClass: TypeOrmVoucherRepository },
    {
      provide: VoucherUsageRepository,
      useClass: TypeOrmVoucherUsageRepository,
    },
    // Short-lived holds, shared between instances through Redis.
    {
      provide: VoucherReservationRepository,
      useClass: RedisVoucherReservationRepository,
    },
    { provide: Clock, useClass: SystemClock },
    {
      provide: ListVouchersUseCase,
      useFactory: (vouchers: VoucherRepository) =>
        new ListVouchersUseCase(vouchers),
      inject: [VoucherRepository],
    },
    // Shared rules, so validating and using can never drift apart
    {
      provide: VoucherEligibility,
      useFactory: (
        vouchers: VoucherRepository,
        usages: VoucherUsageRepository,
        reservations: VoucherReservationRepository,
      ) => new VoucherEligibility(vouchers, usages, reservations),
      inject: [
        VoucherRepository,
        VoucherUsageRepository,
        VoucherReservationRepository,
      ],
    },
    {
      provide: ValidateVoucherUseCase,
      useFactory: (
        eligibility: VoucherEligibility,
        reservations: VoucherReservationRepository,
        clock: Clock,
      ) => new ValidateVoucherUseCase(eligibility, reservations, clock),
      inject: [VoucherEligibility, VoucherReservationRepository, Clock],
    },
    {
      provide: UseVoucherUseCase,
      useFactory: (
        eligibility: VoucherEligibility,
        usages: VoucherUsageRepository,
        reservations: VoucherReservationRepository,
        clock: Clock,
      ) => new UseVoucherUseCase(eligibility, usages, reservations, clock),
      inject: [
        VoucherEligibility,
        VoucherUsageRepository,
        VoucherReservationRepository,
        Clock,
      ],
    },
  ],
})
export class VouchersModule {}
