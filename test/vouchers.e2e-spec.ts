import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserId } from '../src/modules/vouchers/domain/value-objects/user-id.js';
import { AppModule } from '../src/app.module.js';
import { Redis } from 'ioredis';
import { VoucherReservationRepository } from '../src/modules/vouchers/domain/repositories/voucher-reservation.repository.js';
import { RESERVATION_KEY_PREFIX } from '../src/modules/vouchers/infrastructure/persistence/redis/redis-voucher-reservation.repository.js';
import { REDIS_CLIENT } from '../src/shared/infrastructure/cache/redis.module.js';

describe('Vouchers (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let reservations: VoucherReservationRepository;
  let redis: Redis;
  let baseUrl: string;

  /** Fires `times` parallel requests and returns the status codes. */
  const fireInParallel = (
    path: string,
    bodyFor: (index: number) => Record<string, unknown>,
    times: number,
  ): Promise<number[]> =>
    Promise.all(
      Array.from({ length: times }, async (_, i) => {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(bodyFor(i)),
        });
        return response.status;
      }),
    );

  const userNumber = (i: number) =>
    `3f1c5e0a-2b3d-4c5e-8f90-${String(i).padStart(12, '0')}`;

  const insertVoucher = (overrides: Record<string, unknown> = {}) => {
    const row = {
      uuid: crypto.randomUUID(),
      code: `CODE${Math.floor(Math.random() * 1e6)}`,
      value: '25.50',
      validate_date: '2026-10-17 00:00:00',
      limit: 100,
      user_limit: 1,
      restriction: { minCartValue: 200, categories: ['books'] },
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      ...overrides,
    };

    return dataSource.query(
      `INSERT INTO "vouchers"
        ("uuid","code","value","validate_date","limit","user_limit","restriction","created_at","updated_at","deleted_at")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "uuid"`,
      [
        row.uuid,
        row.code,
        row.value,
        row.validate_date,
        row.limit,
        row.user_limit,
        JSON.stringify(row.restriction),
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    // A real listening server: the concurrency tests fire many parallel
    // requests, which supertest's per-call ephemeral servers cannot take.
    await app.listen(0);
    baseUrl = await app.getUrl();

    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations();

    reservations = app.get<VoucherReservationRepository>(
      VoucherReservationRepository,
    );
    redis = app.get<Redis>(REDIS_CLIENT);
  });

  const insertUsage = (userId: string, voucherId: string) =>
    dataSource.query(
      'INSERT INTO "users_vouchers" ("user_id","voucher_id") VALUES ($1,$2)',
      [userId, voucherId],
    );

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "vouchers" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users_vouchers"');
    // The holds live in Redis and survive the truncate.
    const keys = await redis.keys(`${RESERVATION_KEY_PREFIX}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterAll(async () => {
    // `app.close()` runs RedisModule's shutdown hook, which closes the client.
    await app?.close();
  });

  it('returns an empty list when there is no voucher', () =>
    request(app.getHttpServer())
      .get('/vouchers')
      .expect(200)
      .expect(({ body }) => expect(body).toEqual([])));

  it('returns the stored vouchers', async () => {
    await insertVoucher({ code: 'BLACKFRIDAY' });

    const { body } = await request(app.getHttpServer())
      .get('/vouchers')
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      uuid: expect.any(String),
      code: 'BLACKFRIDAY',
      value: 25.5,
      validateDate: expect.stringContaining('2026-10-17'),
      limit: 100,
      userLimit: 1,
      restriction: { minCartValue: 200, categories: ['books'] },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(body[0]).not.toHaveProperty('deletedAt');
  });

  it('supports the nullable columns', async () => {
    await insertVoucher({
      code: 'NOEXPIRY',
      validate_date: null,
      user_limit: null,
      restriction: {},
    });

    const { body } = await request(app.getHttpServer())
      .get('/vouchers')
      .expect(200);

    expect(body[0]).toMatchObject({
      validateDate: null,
      userLimit: null,
      restriction: {},
    });
  });

  describe('POST /vouchers/validate', () => {
    const payload = {
      user_id: '3f1c5e0a-2b3d-4c5e-8f90-123456789abc',
      categories: ['books'],
      code: 'welcome10',
    };

    it('returns the voucher for the given code', async () => {
      await insertVoucher({ code: 'WELCOME10' });

      const { body } = await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);

      expect(body).toMatchObject({
        uuid: expect.any(String),
        code: 'WELCOME10',
        value: 25.5,
        restriction: { minCartValue: 200, categories: ['books'] },
      });
    });

    it('returns the voucher when a category matches restriction.categories', async () => {
      await insertVoucher({
        code: 'WELCOME10',
        restriction: { categories: ['electronics'] },
      });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, categories: ['toys', 'ELECTRONICS'] })
        .expect(200);
    });

    it('returns 409 when no category matches restriction.categories', async () => {
      await insertVoucher({
        code: 'WELCOME10',
        restriction: { categories: ['electronics'] },
      });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, categories: ['toys'] })
        .expect(409)
        .expect(({ body }) =>
          expect(body.error).toBe('VoucherNotAvailableForCategoriesError'),
        );
    });

    it('applies to any category when restriction has no categories', async () => {
      await insertVoucher({
        code: 'WELCOME10',
        restriction: { minCartValue: 200 },
      });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, categories: ['toys'] })
        .expect(200);
    });

    it('returns 409 with the expected message when validate_date has passed', async () => {
      await insertVoucher({
        code: 'WELCOME10',
        validate_date: '2020-01-01 00:00:00',
      });

      const { body } = await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(409);

      expect(body).toMatchObject({
        statusCode: 409,
        error: 'VoucherNotAvailableError',
        message: 'O voucher não está mais disponivel',
      });
    });

    it('returns the voucher when validate_date is null', async () => {
      await insertVoucher({ code: 'WELCOME10', validate_date: null });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
    });

    it('returns 409 when the total limit was reached across all users', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        limit: 2,
        user_limit: null,
      });
      await insertUsage('aa1c5e0a-2b3d-4c5e-8f90-123456789abc', uuid);
      await insertUsage('bb1c5e0a-2b3d-4c5e-8f90-123456789abc', uuid);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(409)
        .expect(({ body }) =>
          expect(body.error).toBe('VoucherLimitReachedError'),
        );
    });

    it('returns the voucher while the total limit is not reached', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        limit: 3,
        user_limit: null,
      });
      await insertUsage('aa1c5e0a-2b3d-4c5e-8f90-123456789abc', uuid);
      await insertUsage('bb1c5e0a-2b3d-4c5e-8f90-123456789abc', uuid);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
    });

    it('returns the voucher while the user is below user_limit', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        user_limit: 2,
      });
      await insertUsage(payload.user_id, uuid);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
    });

    it('returns 409 when the user reached user_limit', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        user_limit: 1,
      });
      await insertUsage(payload.user_id, uuid);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(409)
        .expect(({ body }) =>
          expect(body.error).toBe('VoucherUserLimitReachedError'),
        );
    });

    it('ignores usages from other users', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        user_limit: 1,
      });
      await insertUsage('aa1c5e0a-2b3d-4c5e-8f90-123456789abc', uuid);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
    });

    it('has no per-user limit when user_limit is null', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        user_limit: null,
      });
      await insertUsage(payload.user_id, uuid);
      await insertUsage(payload.user_id, uuid);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
    });

    it('returns 400 for a user_id that is not a uuid', async () => {
      await insertVoucher({ code: 'WELCOME10' });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, user_id: 'not-a-uuid' })
        .expect(400)
        .expect(({ body }) => expect(body.error).toBe('InvalidUserIdError'));
    });

    it('holds the voucher for the user for 15 minutes', async () => {
      await insertVoucher({ code: 'WELCOME10' });

      const before = Date.now();
      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);

      const reservation = await reservations.findActiveByUserAndCode(
        UserId.create(payload.user_id),
        'WELCOME10',
        new Date(),
      );

      expect(reservation).not.toBeNull();
      const ttl = reservation!.expireDate.getTime() - before;
      expect(ttl).toBeGreaterThan(14 * 60_000);
      expect(ttl).toBeLessThanOrEqual(15 * 60_000 + 5_000);
    });

    it('stores the hold in Redis with a matching key TTL', async () => {
      await insertVoucher({ code: 'WELCOME10' });
      const before = Date.now();

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);

      const key = `${RESERVATION_KEY_PREFIX}:WELCOME10`;
      const score = await redis.zscore(key, payload.user_id);
      const keyTtl = await redis.pttl(key);

      expect(score).not.toBeNull();
      expect(Number(score) - before).toBeGreaterThan(14 * 60_000);
      expect(Number(score) - before).toBeLessThanOrEqual(15 * 60_000 + 5_000);
      // The key expires with the last hold, so unused codes clean themselves up.
      expect(keyTtl).toBeGreaterThan(0);
      expect(keyTtl).toBeLessThanOrEqual(15 * 60_000);
    });

    it('drops holds that expired, by score', async () => {
      await insertVoucher({ code: 'WELCOME10', limit: 1, user_limit: null });
      const key = `${RESERVATION_KEY_PREFIX}:WELCOME10`;

      // A hold from another user that expired one minute ago.
      await redis.zadd(
        key,
        Date.now() - 60_000,
        'aa1c5e0a-2b3d-4c5e-8f90-123456789abc',
      );

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);

      expect(
        await redis.zscore(key, 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc'),
      ).toBeNull();
    });

    it("counts another user's hold against the total limit", async () => {
      await insertVoucher({ code: 'WELCOME10', limit: 1, user_limit: null });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, user_id: 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(409)
        .expect(({ body }) =>
          expect(body.error).toBe('VoucherLimitReachedError'),
        );
    });

    it('lets the same user validate again while holding it', async () => {
      await insertVoucher({ code: 'WELCOME10', limit: 1, user_limit: null });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
    });

    it('returns 404 for an unknown code', () =>
      request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, code: 'UNKNOWN' })
        .expect(404)
        .expect(({ body }) => expect(body.error).toBe('VoucherNotFoundError')));

    it('never hands out more holds than the limit under concurrency', async () => {
      const limit = 5;
      const attempts = 25;
      await insertVoucher({ code: 'WELCOME10', limit, user_limit: null });

      const statuses = await fireInParallel(
        '/vouchers/validate',
        (i) => ({ ...payload, user_id: userNumber(i) }),
        attempts,
      );

      expect(statuses.filter((status) => status === 200)).toHaveLength(limit);
      expect(statuses.filter((status) => status === 409)).toHaveLength(
        attempts - limit,
      );

      const holds = await redis.zcard(`${RESERVATION_KEY_PREFIX}:WELCOME10`);
      expect(holds).toBe(limit);
    });

    it('is idempotent for the same user under concurrency', async () => {
      await insertVoucher({ code: 'WELCOME10', limit: 1, user_limit: null });

      const statuses = await fireInParallel(
        '/vouchers/validate',
        () => payload,
        10,
      );

      expect(statuses.every((status) => status === 200)).toBe(true);
      // One user, one hold, and every response saw the same window.
      expect(await redis.zcard(`${RESERVATION_KEY_PREFIX}:WELCOME10`)).toBe(1);
    });

    it('counts the persisted usages against the available holds', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        limit: 2,
        user_limit: null,
      });
      await insertUsage('bb1c5e0a-2b3d-4c5e-8f90-123456789abc', uuid);

      // One unit is already used, so only one hold fits.
      const statuses = await fireInParallel(
        '/vouchers/validate',
        (i) => ({ ...payload, user_id: userNumber(i) }),
        5,
      );

      expect(statuses.filter((status) => status === 200)).toHaveLength(1);
      expect(await redis.zcard(`${RESERVATION_KEY_PREFIX}:WELCOME10`)).toBe(1);
    });

    it('returns 404 for a soft-deleted voucher', async () => {
      await insertVoucher({ code: 'WELCOME10', deleted_at: new Date() });

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(404);
    });

    it('returns 400 for a malformed code', () =>
      request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, code: 'a b' })
        .expect(400)
        .expect(({ body }) =>
          expect(body.error).toBe('InvalidVoucherCodeError'),
        ));
  });

  describe('POST /vouchers/use', () => {
    const payload = {
      user_id: '3f1c5e0a-2b3d-4c5e-8f90-123456789abc',
      categories: ['books'],
      code: 'welcome10',
    };

    const usageRows = (voucherId: string) =>
      dataSource.query(
        'SELECT user_id, voucher_id, created_at FROM "users_vouchers" WHERE voucher_id = $1',
        [voucherId],
      );

    it('moves the hold from Redis into users_vouchers', async () => {
      const [{ uuid }] = await insertVoucher({ code: 'WELCOME10' });
      const key = `${RESERVATION_KEY_PREFIX}:WELCOME10`;

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send(payload)
        .expect(200);
      expect(await redis.zscore(key, payload.user_id)).not.toBeNull();

      const { body } = await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(201);

      expect(body).toMatchObject({ uuid, code: 'WELCOME10' });
      expect(await redis.zscore(key, payload.user_id)).toBeNull();

      const rows = await usageRows(uuid);
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe(payload.user_id);
    });

    it('works without validating first', async () => {
      const [{ uuid }] = await insertVoucher({ code: 'WELCOME10' });

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(201);

      expect(await usageRows(uuid)).toHaveLength(1);
    });

    it('keeps the holds of other users', async () => {
      const [{ uuid }] = await insertVoucher({ code: 'WELCOME10', limit: 5 });
      const other = 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc';

      await request(app.getHttpServer())
        .post('/vouchers/validate')
        .send({ ...payload, user_id: other })
        .expect(200);

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(201);

      const key = `${RESERVATION_KEY_PREFIX}:WELCOME10`;
      expect(await redis.zscore(key, other)).not.toBeNull();
      expect(await usageRows(uuid)).toHaveLength(1);
    });

    it('exhausts the voucher once the total limit is reached', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        limit: 1,
        user_limit: null,
      });

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send({ ...payload, user_id: 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc' })
        .expect(409)
        .expect(({ body }) =>
          expect(body.error).toBe('VoucherLimitReachedError'),
        );

      expect(await usageRows(uuid)).toHaveLength(1);
    });

    it('enforces the per-user limit', async () => {
      await insertVoucher({ code: 'WELCOME10', limit: 10, user_limit: 1 });

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(409)
        .expect(({ body }) =>
          expect(body.error).toBe('VoucherUserLimitReachedError'),
        );
    });

    it('does not record a usage when a rule fails', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        validate_date: '2020-01-01 00:00:00',
      });

      await request(app.getHttpServer())
        .post('/vouchers/use')
        .send(payload)
        .expect(409)
        .expect(({ body }) =>
          expect(body.message).toBe('O voucher não está mais disponivel'),
        );

      expect(await usageRows(uuid)).toHaveLength(0);
    });

    it('returns 404 for an unknown code', () =>
      request(app.getHttpServer())
        .post('/vouchers/use')
        .send({ ...payload, code: 'UNKNOWN' })
        .expect(404));

    it('never exceeds the limit under concurrent requests', async () => {
      const limit = 5;
      const attempts = 25;
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        limit,
        user_limit: null,
      });

      // Every request targets the last units at the same time.
      const statuses = await fireInParallel(
        '/vouchers/use',
        (i) => ({ ...payload, user_id: userNumber(i) }),
        attempts,
      );

      expect(statuses.filter((status) => status === 201)).toHaveLength(limit);
      expect(statuses.filter((status) => status === 409)).toHaveLength(
        attempts - limit,
      );
      expect(await usageRows(uuid)).toHaveLength(limit);
    });

    it('never exceeds user_limit under concurrent requests from one user', async () => {
      const [{ uuid }] = await insertVoucher({
        code: 'WELCOME10',
        limit: 100,
        user_limit: 2,
      });

      const statuses = await fireInParallel('/vouchers/use', () => payload, 10);

      expect(statuses.filter((status) => status === 201)).toHaveLength(2);
      expect(await usageRows(uuid)).toHaveLength(2);
    });
  });

  it('hides soft-deleted vouchers', async () => {
    await insertVoucher({ code: 'ACTIVE' });
    await insertVoucher({ code: 'REMOVED', deleted_at: new Date() });

    const { body } = await request(app.getHttpServer())
      .get('/vouchers')
      .expect(200);

    expect(body.map((voucher: { code: string }) => voucher.code)).toEqual([
      'ACTIVE',
    ]);
  });
});
