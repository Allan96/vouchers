import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UserId } from '../src/modules/vouchers/domain/value-objects/user-id.js';
import { AppModule } from '../src/app.module.js';
import { InMemoryVoucherReservationRepository } from '../src/modules/vouchers/infrastructure/persistence/in-memory/in-memory-voucher-reservation.repository.js';
import { VoucherReservationRepository } from '../src/modules/vouchers/domain/repositories/voucher-reservation.repository.js';

describe('Vouchers (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let reservations: InMemoryVoucherReservationRepository;

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

    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations();

    reservations = app.get<InMemoryVoucherReservationRepository>(
      VoucherReservationRepository,
    );
  });

  const insertUsage = (userId: string, voucherId: string) =>
    dataSource.query(
      'INSERT INTO "users_vouchers" ("user_id","voucher_id") VALUES ($1,$2)',
      [userId, voucherId],
    );

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "vouchers" CASCADE');
    await dataSource.query('TRUNCATE TABLE "users_vouchers"');
    // The holds live in memory and survive the truncate.
    reservations.clear();
  });

  afterAll(async () => {
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
