import type { KnowledgeService } from '#services/knowledge.service.ts';
import type { KnowledgeTypesService } from '#services/knowledge-types.service.ts';
import type { PeopleService } from '#services/people.service.ts';
import type { RecordsService } from '#services/records.service.ts';

export type KnowledgeReader = Pick<
  KnowledgeService,
  | 'search'
  | 'getKnowledge'
  | 'create'
  | 'update'
  | 'remove'
  | 'getKnowledgeIndexHtmlPage'
  | 'getKnowledgeHtmlPage'
>;
export type RecordsReader = Pick<RecordsService, 'search' | 'listSources'>;
export type PeopleReader = Pick<PeopleService, 'listPeople' | 'findByNameOrEmail'>;
export type KnowledgeTypesReader = Pick<KnowledgeTypesService, 'list' | 'create' | 'update'>;

export type KnowledgeMcpServices = {
  knowledge: KnowledgeReader;
  records: RecordsReader;
  people: PeopleReader;
  knowledgeTypes: KnowledgeTypesReader;
};

export type KnowledgePageReader = Pick<
  KnowledgeReader,
  'getKnowledgeIndexHtmlPage' | 'getKnowledgeHtmlPage'
>;
export type DataSource = Awaited<ReturnType<RecordsReader['listSources']>>['sources'][number];
export type Person = Awaited<ReturnType<PeopleReader['listPeople']>>['people'][number];
