import { Elysia } from 'elysia';
import { sql } from '#db/client.ts';
import { createLogger } from '#lib/logger.ts';
import { HealthRepository } from '#repositories/health.repository.ts';
import { RecordsRepository } from '#repositories/records.repository.ts';
import { HealthService } from '#services/health.service.ts';
import { RecordsService } from '#services/records.service.ts';

const healthRepo = new HealthRepository(sql);
const recordsRepo = new RecordsRepository(sql);

const healthService = new HealthService(healthRepo);
const recordsService = new RecordsService(recordsRepo);

export function loggerPlugin(name: string) {
  const logger = createLogger(name);
  return new Elysia({ name: `logger.${name}` }).derive({ as: 'scoped' }, () => ({ logger }));
}

export const HealthServicePlugin = new Elysia({ name: 'service.health' }).decorate(
  'healthService',
  healthService,
);

export const RecordsServicePlugin = new Elysia({ name: 'service.records' }).decorate(
  'recordsService',
  recordsService,
);
