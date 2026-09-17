import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

/** Serves the OpenAPI document at `/docs` (JSON at `/docs-json`). */
export const setupSwagger = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle('skeleton_v2')
    .setDescription(
      'Modular monolith with hexagonal architecture: users and vouchers.',
    )
    .setVersion('1.0')
    .addTag('users')
    .addTag('vouchers')
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, () =>
    SwaggerModule.createDocument(app, config),
  );
};
