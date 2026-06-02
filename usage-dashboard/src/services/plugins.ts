import { Elysia } from 'elysia';

import { sql } from '#db/client.ts';
import { createLogger } from '#lib/logger.ts';
import { HealthRepository } from '#repositories/health.repository.ts';
import { UsageRepository } from '#repositories/usage.repository.ts';
import { HealthService } from '#services/health.service.ts';
import { loadPricing } from '#services/pricing.ts';
import { UsageService } from '#services/usage.service.ts';

const healthRepo = new HealthRepository(sql);
const usageRepo = new UsageRepository(sql);

const healthService = new HealthService(healthRepo);
const usageService = new UsageService(usageRepo, loadPricing());

export function loggerPlugin(name: string) {
  const logger = createLogger(name);
  return new Elysia({ name: `logger.${name}` }).derive({ as: 'scoped' }, () => ({ logger }));
}

export const HealthServicePlugin = new Elysia({ name: 'service.health' }).decorate(
  'healthService',
  healthService,
);

export const UsageServicePlugin = new Elysia({ name: 'service.usage' }).decorate(
  'usageService',
  usageService,
);
