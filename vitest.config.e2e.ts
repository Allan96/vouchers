import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // E2E runs against a real Postgres. Everything else comes from .env.
    env: { NODE_ENV: 'test', DATABASE_NAME: 'skeleton_v2_test' },
    // The test database is shared, so suites must not run in parallel.
    fileParallelism: false,
  },
});
