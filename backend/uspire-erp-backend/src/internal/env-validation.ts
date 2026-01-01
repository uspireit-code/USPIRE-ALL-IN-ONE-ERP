import { Logger } from '@nestjs/common';
import { getFirstEnv, isTruthyEnv } from './env.util';

export function validateEnvOrExit() {
  if (process.env.NODE_ENV !== 'production') return;

  const required: Array<{ name: string; keys: string[] }> = [
    { name: 'DATABASE_URL', keys: ['DATABASE_URL'] },
    { name: 'JWT_ACCESS_SECRET', keys: ['JWT_ACCESS_SECRET'] },
    { name: 'JWT_REFRESH_SECRET', keys: ['JWT_REFRESH_SECRET'] },
    {
      name: 'JWT_ACCESS_TTL',
      keys: ['JWT_ACCESS_TTL', 'JWT_ACCESS_EXPIRES_IN'],
    },
    {
      name: 'JWT_REFRESH_TTL',
      keys: ['JWT_REFRESH_TTL', 'JWT_REFRESH_EXPIRES_IN'],
    },
    { name: 'CORS_ORIGIN', keys: ['CORS_ORIGIN'] },
    { name: 'APP_BASE_URL', keys: ['APP_BASE_URL'] },
    { name: 'STORAGE_PROVIDER', keys: ['STORAGE_PROVIDER'] },
    { name: 'STORAGE_LOCAL_PATH', keys: ['STORAGE_LOCAL_PATH'] },
    { name: 'LOG_LEVEL', keys: ['LOG_LEVEL'] },
    { name: 'RATE_LIMIT_ENABLED', keys: ['RATE_LIMIT_ENABLED'] },
    { name: 'TIMEOUTS_ENABLED', keys: ['TIMEOUTS_ENABLED'] },
    { name: 'CACHE_ENABLED', keys: ['CACHE_ENABLED'] },
  ];

  const missing: string[] = [];

  for (const item of required) {
    const v = getFirstEnv(item.keys);
    if (v === undefined) missing.push(item.name);
  }

  const logger = new Logger('EnvValidation');

  if (missing.length > 0) {
    logger.error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local')
    .trim()
    .toLowerCase();
  if (storageProvider !== 'local') {
    logger.error('Unsupported STORAGE_PROVIDER (only local is implemented)');
    process.exit(1);
  }

  const rateLimitEnabled = isTruthyEnv(process.env.RATE_LIMIT_ENABLED, true);
  const timeoutsEnabled = isTruthyEnv(process.env.TIMEOUTS_ENABLED, true);
  const cacheEnabled = isTruthyEnv(process.env.CACHE_ENABLED, true);

  logger.log(
    JSON.stringify({
      nodeEnv: process.env.NODE_ENV,
      rateLimitEnabled,
      timeoutsEnabled,
      cacheEnabled,
    }),
  );
}
