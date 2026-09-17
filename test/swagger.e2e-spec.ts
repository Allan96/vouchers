import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupSwagger } from '../src/shared/presentation/http/swagger.js';

describe('Swagger (e2e)', () => {
  let app: INestApplication;
  let document: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();

    ({ body: document } = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves the documentation page', () =>
    request(app.getHttpServer())
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/));

  it('documents every route', () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      '/users',
      '/users/{id}',
      '/vouchers',
      '/vouchers/validate',
    ]);
  });

  it('groups the routes by module', () => {
    expect(document.paths['/users'].post.tags).toEqual(['users']);
    expect(document.paths['/vouchers/validate'].post.tags).toEqual([
      'vouchers',
    ]);
  });

  it('documents the validate payload in snake_case', () => {
    const schema = document.components.schemas.ValidateVoucherRequest;

    expect(Object.keys(schema.properties).sort()).toEqual([
      'categories',
      'code',
      'user_id',
    ]);
    expect(schema.required.sort()).toEqual(['categories', 'code', 'user_id']);
    expect(schema.properties.categories.type).toBe('array');
  });

  it('documents the voucher response, including the nullable columns', () => {
    const schema = document.components.schemas.VoucherResponse;

    expect(Object.keys(schema.properties).sort()).toEqual([
      'code',
      'createdAt',
      'limit',
      'restriction',
      'updatedAt',
      'userLimit',
      'uuid',
      'validateDate',
      'value',
    ]);
    expect(schema.properties.validateDate.nullable).toBe(true);
    expect(schema.properties.userLimit.nullable).toBe(true);
  });

  it('documents the domain error responses', () => {
    const responses = document.paths['/vouchers/validate'].post.responses;

    for (const status of ['400', '404', '409']) {
      expect(
        responses[status].content['application/json'].schema.$ref,
      ).toContain('ErrorResponse');
    }
  });
});
