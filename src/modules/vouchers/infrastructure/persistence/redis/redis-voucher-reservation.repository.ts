import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REDIS_CLIENT } from '../../../../../shared/infrastructure/cache/redis.module.js';
import {
  RESERVATION_TTL_MINUTES,
  VoucherReservation,
} from '../../../domain/entities/voucher-reservation.js';
import { VoucherReservationRepository } from '../../../domain/repositories/voucher-reservation.repository.js';
import { UserId } from '../../../domain/value-objects/user-id.js';

export const RESERVATION_KEY_PREFIX = 'vouchers:reservations';

/**
 * Holds live in a sorted set per voucher code: member is the user id and score
 * is the `expireDate` in epoch milliseconds. That makes counting the active
 * holds a single range query, and expired entries are dropped by score before
 * every read. The key itself also gets a TTL, so a code nobody validates again
 * disappears on its own.
 */
const RESERVE_SCRIPT = readFileSync(
  join(import.meta.dirname, 'reserve-voucher.lua'),
  'utf8',
);

interface RedisWithReserve extends Redis {
  reserveVoucher(
    key: string,
    userId: string,
    now: string,
    expireAt: string,
    maxActiveHolds: string,
  ): Promise<[number, string]>;
}

@Injectable()
export class RedisVoucherReservationRepository extends VoucherReservationRepository {
  private readonly client: RedisWithReserve;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
    this.redis.defineCommand('reserveVoucher', {
      numberOfKeys: 1,
      lua: RESERVE_SCRIPT,
    });
    this.client = this.redis as RedisWithReserve;
  }

  /**
   * Counting the active holds and taking one has to be atomic, otherwise two
   * concurrent validations on the last unit would both see a free slot. The Lua
   * script runs as a single Redis command, so no other client interleaves.
   */
  async reserve(
    userId: UserId,
    code: string,
    now: Date,
    maxActiveHolds: number,
  ): Promise<VoucherReservation | null> {
    const expireAt = now.getTime() + RESERVATION_TTL_MINUTES * 60_000;

    const [taken, value] = await this.client.reserveVoucher(
      this.key(code),
      userId.value,
      String(now.getTime()),
      String(expireAt),
      String(maxActiveHolds),
    );

    return taken === 1
      ? VoucherReservation.restore(userId, code, new Date(Number(value)))
      : null;
  }

  async findActiveByUserAndCode(
    userId: UserId,
    code: string,
    now: Date,
  ): Promise<VoucherReservation | null> {
    const score = await this.redis.zscore(this.key(code), userId.value);
    if (score === null) {
      return null;
    }

    const expireDate = new Date(Number(score));
    const reservation = VoucherReservation.restore(userId, code, expireDate);
    return reservation.isActive(now) ? reservation : null;
  }

  async countActiveByCodeExcludingUser(
    code: string,
    userId: UserId,
    now: Date,
  ): Promise<number> {
    const key = this.key(code);

    const [, [, active], [, ownScore]] = (await this.redis
      .multi()
      .zremrangebyscore(key, 0, now.getTime())
      .zcard(key)
      .zscore(key, userId.value)
      .exec()) as [unknown, [unknown, number], [unknown, string | null]];

    return active - (ownScore === null ? 0 : 1);
  }

  async remove(userId: UserId, code: string): Promise<void> {
    await this.redis.zrem(this.key(code), userId.value);
  }

  private key(code: string): string {
    return `${RESERVATION_KEY_PREFIX}:${code}`;
  }
}
