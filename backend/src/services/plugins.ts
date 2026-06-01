import { Elysia } from 'elysia';
import { sql } from '#db/client.ts';
import { createLogger } from '#lib/logger.ts';
import { HealthRepository } from '#repositories/health.repository.ts';
import { HealthService } from '#services/health.service.ts';

const healthRepo = new HealthRepository(sql);

const healthService = new HealthService(healthRepo);

// Decorates the controller with a logger prefixed by its name, and logs each
// request it handles under that same prefix.
export function loggerPlugin(name: string) {
  const logger = createLogger(name);
  return new Elysia({ name: `logger.${name}` })
    .decorate('logger', logger)
    .onRequest(({ request }) => {
      logger.info(`→ ${request.method} ${new URL(request.url).pathname}`);
    });
}

export const HealthServicePlugin = new Elysia({ name: 'service.health' }).decorate(
  'healthService',
  healthService,
);
