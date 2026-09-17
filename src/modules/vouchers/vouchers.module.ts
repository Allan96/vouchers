import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListVouchersUseCase } from './application/use-cases/list-vouchers.use-case.js';
import { ValidateVoucherUseCase } from './application/use-cases/validate-voucher.use-case.js';
import { Clock } from './application/ports/clock.js';
import { VoucherReservationRepository } from './domain/repositories/voucher-reservation.repository.js';
import { VoucherUsageRepository } from './domain/repositories/voucher-usage.repository.js';
import { VoucherRepository } from './domain/repositories/voucher.repository.js';
import { InMemoryVoucherReservationRepository } from './infrastructure/persistence/in-memory/in-memory-voucher-reservation.repository.js';
import { TypeOrmVoucherUsageRepository } from './infrastructure/persistence/typeorm/typeorm-voucher-usage.repository.js';
import { TypeOrmVoucherRepository } from './infrastructure/persistence/typeorm/typeorm-voucher.repository.js';
import { VoucherUsageOrmEntity } from './infrastructure/persistence/typeorm/voucher-usage.orm-entity.js';
import { VoucherOrmEntity } from './infrastructure/persistence/typeorm/voucher.orm-entity.js';
import { SystemClock } from './infrastructure/services/system-clock.js';
import { VouchersController } from './presentation/http/controllers/vouchers.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoucherOrmEntity, VoucherUsageOrmEntity]),
  ],
  controllers: [VouchersController],
  providers: [
    { provide: VoucherRepository, useClass: TypeOrmVoucherRepository },
    {
      provide: VoucherUsageRepository,
      useClass: TypeOrmVoucherUsageRepository,
    },
    // Reservations are short-lived holds, kept in this instance's memory.
    {
      provide: VoucherReservationRepository,
      useClass: InMemoryVoucherReservationRepository,
    },
    { provide: Clock, useClass: SystemClock },
    {
      provide: ListVouchersUseCase,
      useFactory: (vouchers: VoucherRepository) =>
        new ListVouchersUseCase(vouchers),
      inject: [VoucherRepository],
    },
    {
      provide: ValidateVoucherUseCase,
      useFactory: (
        vouchers: VoucherRepository,
        usages: VoucherUsageRepository,
        reservations: VoucherReservationRepository,
        clock: Clock,
      ) => new ValidateVoucherUseCase(vouchers, usages, reservations, clock),
      inject: [
        VoucherRepository,
        VoucherUsageRepository,
        VoucherReservationRepository,
        Clock,
      ],
    },
  ],
})
export class VouchersModule {}
