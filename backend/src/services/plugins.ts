import { Elysia } from 'elysia';
import { sql } from '#db/client.ts';
import { createLogger } from '#lib/logger.ts';
import { HealthRepository } from '#repositories/health.repository.ts';
import { HealthService } from '#services/health.service.ts';

const healthRepo = new HealthRepository(sql);

const healthService = new HealthService(healthRepo);

export function loggerPlugin(name: string) {
  const logger = createLogger(name);
  return new Elysia({ name: `logger.${name}` }).derive({ as: 'scoped' }, () => ({ logger }));
}

export const HealthServicePlugin = new Elysia({ name: 'service.health' }).decorate(
  'healthService',
  healthService,
);
