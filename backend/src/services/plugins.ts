import { Elysia } from 'elysia';
import { sql } from '#db/client.ts';
import { createLogger } from '#lib/logger.ts';
import { HealthRepository } from '#repositories/health.repository.ts';
import { KnowledgeRepository } from '#repositories/knowledge.repository.ts';
import { KnowledgeTypesRepository } from '#repositories/knowledge-types.repository.ts';
import { PeopleRepository } from '#repositories/people.repository.ts';
import { RecordsRepository } from '#repositories/records.repository.ts';
import { HealthService } from '#services/health.service.ts';
import { KnowledgeService } from '#services/knowledge.service.ts';
import { KnowledgeMcpService } from '#services/knowledge-mcp.service.ts';
import { KnowledgeTypesService } from '#services/knowledge-types.service.ts';
import { LogtoDcrService } from '#services/logto-dcr.service.ts';
import { PeopleService } from '#services/people.service.ts';
import { RecordsService } from '#services/records.service.ts';

const healthRepo = new HealthRepository(sql);
const recordsRepo = new RecordsRepository(sql);
const peopleRepo = new PeopleRepository(sql);
const knowledgeTypesRepo = new KnowledgeTypesRepository(sql);
const knowledgeRepo = new KnowledgeRepository(sql);

const healthService = new HealthService(healthRepo);
const recordsService = new RecordsService(recordsRepo);
const peopleService = new PeopleService(peopleRepo);
const knowledgeTypesService = new KnowledgeTypesService(knowledgeTypesRepo);
const knowledgeService = new KnowledgeService(knowledgeRepo);
const knowledgeMcpService = new KnowledgeMcpService(knowledgeService);
const logtoDcrService = new LogtoDcrService();

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

export const PeopleServicePlugin = new Elysia({ name: 'service.people' }).decorate(
  'peopleService',
  peopleService,
);

export const KnowledgeTypesServicePlugin = new Elysia({ name: 'service.knowledgeTypes' }).decorate(
  'knowledgeTypesService',
  knowledgeTypesService,
);

export const KnowledgeServicePlugin = new Elysia({ name: 'service.knowledge' }).decorate(
  'knowledgeService',
  knowledgeService,
);

export const KnowledgeMcpServicePlugin = new Elysia({ name: 'service.knowledgeMcp' }).decorate(
  'knowledgeMcpService',
  knowledgeMcpService,
);

export const LogtoDcrServicePlugin = new Elysia({ name: 'service.logtoDcr' }).decorate(
  'logtoDcrService',
  logtoDcrService,
);
