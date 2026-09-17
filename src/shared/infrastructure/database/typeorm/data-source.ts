import { config } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnv } from '../../config/env.js';
import { buildDataSourceOptions } from './typeorm.config.js';

config();

/**
 * DataSource used by the TypeORM CLI (migrations). It runs against the compiled
 * output, so entities are discovered from `dist`.
 */
export default new DataSource({
  ...buildDataSourceOptions(validateEnv(process.env)),
  entities: [join(import.meta.dirname, '../../../../**/*.orm-entity.js')],
});
