import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(getDataSourceToken());
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "users"');
  });

  afterAll(async () => {
    await app?.close();
  });

  const createUser = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/users').send(body);

  it('creates, lists and fetches a user', async () => {
    const created = await createUser({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    }).expect(201);

    expect(created.body).toMatchObject({
      id: expect.any(String),
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      createdAt: expect.any(String),
    });

    await request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));

    await request(app.getHttpServer())
      .get(`/users/${created.body.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));
  });

  it('persists the user in Postgres', async () => {
    const created = await createUser({
      name: 'Alan Turing',
      email: 'alan@example.com',
    }).expect(201);

    const rows = await dataSource.query(
      'SELECT id, name, email, created_at FROM "users" WHERE id = $1',
      [created.body.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Alan Turing',
      email: 'alan@example.com',
    });
  });

  it('returns 400 for invalid email', () =>
    createUser({ name: 'Ada', email: 'invalid' })
      .expect(400)
      .expect(({ body }) => expect(body.error).toBe('InvalidEmailError')));

  it('returns 409 for duplicated email', async () => {
    const payload = { name: 'Ada', email: 'ada@example.com' };
    await createUser(payload).expect(201);
    await createUser(payload).expect(409);
  });

  it('returns 404 for unknown user', () =>
    request(app.getHttpServer())
      .get('/users/7f1c5e0a-2b3d-4c5e-8f90-123456789abc')
      .expect(404));
});
