export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  DATABASE_SSL: boolean;
  DATABASE_LOGGING: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string | null;
  REDIS_DB: number;
}

const asString = (raw: Record<string, unknown>, key: keyof Env): string => {
  const value = raw[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing environment variable "${key}"`);
  }
  return value.trim();
};

const asNumber = (
  raw: Record<string, unknown>,
  key: keyof Env,
  fallback: number,
): number => {
  if (raw[key] === undefined || raw[key] === '') return fallback;
  const value = Number(raw[key]);
  if (!Number.isInteger(value)) {
    throw new Error(`Environment variable "${key}" must be an integer`);
  }
  return value;
};

const asBoolean = (raw: Record<string, unknown>, key: keyof Env): boolean =>
  raw[key] === 'true' || raw[key] === true;

const asOptionalString = (
  raw: Record<string, unknown>,
  key: keyof Env,
): string | null => {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/** Fails fast at bootstrap when the environment is incomplete. */
export const validateEnv = (raw: Record<string, unknown>): Env => ({
  NODE_ENV: (raw.NODE_ENV as Env['NODE_ENV']) ?? 'development',
  PORT: asNumber(raw, 'PORT', 3000),
  DATABASE_HOST: asString(raw, 'DATABASE_HOST'),
  DATABASE_PORT: asNumber(raw, 'DATABASE_PORT', 5432),
  DATABASE_USER: asString(raw, 'DATABASE_USER'),
  DATABASE_PASSWORD: asString(raw, 'DATABASE_PASSWORD'),
  DATABASE_NAME: asString(raw, 'DATABASE_NAME'),
  DATABASE_SSL: asBoolean(raw, 'DATABASE_SSL'),
  DATABASE_LOGGING: asBoolean(raw, 'DATABASE_LOGGING'),
  REDIS_HOST: asString(raw, 'REDIS_HOST'),
  REDIS_PORT: asNumber(raw, 'REDIS_PORT', 6379),
  REDIS_PASSWORD: asOptionalString(raw, 'REDIS_PASSWORD'),
  REDIS_DB: asNumber(raw, 'REDIS_DB', 0),
});
