import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { UsersModule } from './modules/users/users.module.js';
import { VouchersModule } from './modules/vouchers/vouchers.module.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { DomainErrorFilter } from './shared/presentation/http/filters/domain-error.filter.js';

@Module({
  imports: [DatabaseModule, UsersModule, VouchersModule],
  providers: [{ provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
