import { describe, expect, it } from 'bun:test';
import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import {
  type CreateKnowledgeInput,
  type CreateKnowledgeResult,
  KnowledgeRepositoryContract,
  type KnowledgeRow,
  type KnowledgeSearchPage,
  type KnowledgeSearchParams,
} from '#repositories/knowledge.repository.ts';
import { KnowledgeService } from '#services/knowledge.service.ts';

const HIT_SCORE = 1.5;
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const UPDATED_AT = new Date('2026-02-01T00:00:00.000Z');

const ROW: KnowledgeRow = {
  id: '019e8882-07f1-771c-993e-f6825a9224bb',
  created_at: CREATED_AT,
  updated_at: UPDATED_AT,
  title: 'Q1 pricing decision',
  body: 'We agreed to keep the starter tier free.',
  knowledge_type_id: '019e8000-0000-7000-8000-000000000001',
  knowledge_type_name: 'decision',
  participants: [],
  source_record_ids: ['019e7000-0000-7000-8000-000000000002'],
};

class MockKnowledgeRepository extends KnowledgeRepositoryContract {
  searchCalls: KnowledgeSearchParams[] = [];
  createCalls: CreateKnowledgeInput[] = [];

  constructor(
    private readonly page: KnowledgeSearchPage = { total: 0, results: [] },
    private readonly row: KnowledgeRow | null = null,
    private readonly createResult: CreateKnowledgeResult = { ok: true, id: ROW.id },
  ) {
    super();
  }

  search(params: KnowledgeSearchParams): Promise<KnowledgeSearchPage> {
    this.searchCalls.push(params);
    return Promise.resolve(this.page);
  }

  getById(): Promise<KnowledgeRow | null> {
    return Promise.resolve(this.row);
  }

  create(input: CreateKnowledgeInput): Promise<CreateKnowledgeResult> {
    this.createCalls.push(input);
    return Promise.resolve(this.createResult);
  }
}

describe('KnowledgeService', () => {
  it('rejects sort_by=relevance without a query', async () => {
    const service = new KnowledgeService(new MockKnowledgeRepository());
    await expect(
      service.search({ sortBy: 'relevance', limit: 20, offset: 0 }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('echoes pagination and maps the timestamp columns to ISO strings', async () => {
    const repo = new MockKnowledgeRepository({
      total: 1,
      results: [{ ...ROW, score: HIT_SCORE, snippet: 'starter tier free' }],
    });
    const service = new KnowledgeService(repo);

    const result = await service.search({ query: 'pricing', limit: 10, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    const [hit] = result.results;
    expect(hit?.created_at).toBe(CREATED_AT.toISOString());
    expect(hit?.updated_at).toBe(UPDATED_AT.toISOString());
    expect(hit?.knowledge_type).toEqual({ id: ROW.knowledge_type_id, name: 'decision' });
    expect(hit?.score).toBe(HIT_SCORE);
    expect(hit?.source_record_ids).toEqual(ROW.source_record_ids);
  });

  it('throws when the knowledge item is missing', async () => {
    const service = new KnowledgeService(new MockKnowledgeRepository(undefined, null));
    await expect(service.getKnowledge(ROW.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps a found knowledge item', async () => {
    const service = new KnowledgeService(new MockKnowledgeRepository(undefined, ROW));
    const item = await service.getKnowledge(ROW.id);
    expect(item.title).toBe('Q1 pricing decision');
    expect(item.knowledge_type.name).toBe('decision');
  });

  it('dedupes link ids before creating and returns the created item', async () => {
    const repo = new MockKnowledgeRepository(undefined, ROW, { ok: true, id: ROW.id });
    const service = new KnowledgeService(repo);

    const item = await service.create({
      title: ROW.title,
      body: ROW.body,
      knowledge_type_id: ROW.knowledge_type_id,
      person_ids: ['019e9000-0000-7000-8000-00000000000a', '019e9000-0000-7000-8000-00000000000a'],
      record_ids: [],
    });

    expect(repo.createCalls[0]?.personIds).toEqual(['019e9000-0000-7000-8000-00000000000a']);
    expect(item.id).toBe(ROW.id);
  });

  it('rejects unknown referenced ids with a 400', async () => {
    const repo = new MockKnowledgeRepository(undefined, null, {
      ok: false,
      missingType: true,
      missingPersonIds: [],
      missingRecordIds: ['019e7000-0000-7000-8000-000000000099'],
    });
    const service = new KnowledgeService(repo);

    await expect(
      service.create({
        title: 'x',
        body: 'y',
        knowledge_type_id: '019e8000-0000-7000-8000-0000000000ff',
        person_ids: [],
        record_ids: ['019e7000-0000-7000-8000-000000000099'],
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
