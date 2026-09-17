import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions.js';
import type { Env } from '../../config/env.js';
import { migrations } from './migrations/index.js';

/** Only the database slice of the environment. */
export type DatabaseEnv = Pick<
  Env,
  | 'DATABASE_HOST'
  | 'DATABASE_PORT'
  | 'DATABASE_USER'
  | 'DATABASE_PASSWORD'
  | 'DATABASE_NAME'
  | 'DATABASE_SSL'
  | 'DATABASE_LOGGING'
>;

export const buildDataSourceOptions = (
  env: DatabaseEnv,
): PostgresDataSourceOptions => ({
  type: 'postgres',
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  username: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  logging: env.DATABASE_LOGGING,
  // The schema is owned by the migrations, never by the entity metadata.
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: 'migrations',
  migrations,
});
