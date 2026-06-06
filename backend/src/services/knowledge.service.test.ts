import { describe, expect, it } from 'bun:test';
import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import {
  type CreateKnowledgeInput,
  type CreateKnowledgeResult,
  type KnowledgeFullSearchPage,
  type KnowledgePreviewSearchPage,
  KnowledgeRepositoryContract,
  type KnowledgeRow,
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
  previewSearchCalls: KnowledgeSearchParams[] = [];
  fullSearchCalls: KnowledgeSearchParams[] = [];
  createCalls: CreateKnowledgeInput[] = [];

  private readonly previewPage: KnowledgePreviewSearchPage;
  private readonly fullPage: KnowledgeFullSearchPage;
  private readonly row: KnowledgeRow | null;
  private readonly createResult: CreateKnowledgeResult;

  constructor({
    previewPage = { total: 0, results: [] },
    fullPage = { total: 0, results: [] },
    row = null,
    createResult = { ok: true, id: ROW.id },
  }: {
    previewPage?: KnowledgePreviewSearchPage;
    fullPage?: KnowledgeFullSearchPage;
    row?: KnowledgeRow | null;
    createResult?: CreateKnowledgeResult;
  } = {}) {
    super();
    this.previewPage = previewPage;
    this.fullPage = fullPage;
    this.row = row;
    this.createResult = createResult;
  }

  searchPreview(params: KnowledgeSearchParams): Promise<KnowledgePreviewSearchPage> {
    this.previewSearchCalls.push(params);
    return Promise.resolve(this.previewPage);
  }

  searchFull(params: KnowledgeSearchParams): Promise<KnowledgeFullSearchPage> {
    this.fullSearchCalls.push(params);
    return Promise.resolve(this.fullPage);
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

  it('returns preview hits by default', async () => {
    const repo = new MockKnowledgeRepository({
      previewPage: {
        total: 1,
        results: [ROW],
      },
    });
    const service = new KnowledgeService(repo);

    const result = await service.search({ query: 'pricing', limit: 10, offset: 0 });

    expect(result).toEqual({
      total: 1,
      limit: 10,
      offset: 0,
      results: [{ id: ROW.id, title: ROW.title }],
    });
    expect(repo.previewSearchCalls).toHaveLength(1);
    expect(repo.fullSearchCalls).toHaveLength(0);
  });

  it('echoes pagination and maps the timestamp columns to ISO strings', async () => {
    const repo = new MockKnowledgeRepository({
      fullPage: {
        total: 1,
        results: [{ ...ROW, score: HIT_SCORE, snippet: 'starter tier free' }],
      },
    });
    const service = new KnowledgeService(repo);

    const result = await service.search({ query: 'pricing', view: 'full', limit: 10, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    const [hit] = result.results;
    expect(hit).toMatchObject({
      created_at: CREATED_AT.toISOString(),
      updated_at: UPDATED_AT.toISOString(),
      knowledge_type: { id: ROW.knowledge_type_id, name: 'decision' },
      score: HIT_SCORE,
      source_record_ids: ROW.source_record_ids,
    });
    expect(repo.fullSearchCalls).toHaveLength(1);
  });

  it('throws when the knowledge item is missing', async () => {
    const service = new KnowledgeService(new MockKnowledgeRepository());
    await expect(service.getKnowledge(ROW.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps a found knowledge item', async () => {
    const service = new KnowledgeService(new MockKnowledgeRepository({ row: ROW }));
    const item = await service.getKnowledge(ROW.id);
    expect(item.title).toBe('Q1 pricing decision');
    expect(item.html_url).toBe(`/knowledge/pages/${ROW.id}`);
    expect(item.knowledge_type.name).toBe('decision');
  });

  it('dedupes link ids before creating and returns the created item', async () => {
    const repo = new MockKnowledgeRepository({ row: ROW, createResult: { ok: true, id: ROW.id } });
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

  it('sanitizes HTML before creating knowledge', async () => {
    const repo = new MockKnowledgeRepository({ row: ROW, createResult: { ok: true, id: ROW.id } });
    const service = new KnowledgeService(repo);

    await service.create({
      title: ROW.title,
      body: '<p>Safe</p><script>alert("x")</script>',
      knowledge_type_id: ROW.knowledge_type_id,
      person_ids: [],
      record_ids: [],
    });

    expect(repo.createCalls[0]?.body).toBe('<p>Safe</p>');
  });

  it('rejects HTML that has no safe content', async () => {
    const service = new KnowledgeService(new MockKnowledgeRepository());

    await expect(
      service.create({
        title: ROW.title,
        body: '<script>alert("x")</script>',
        knowledge_type_id: ROW.knowledge_type_id,
        person_ids: [],
        record_ids: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('renders knowledge as a sanitized HTML page', async () => {
    const service = new KnowledgeService(
      new MockKnowledgeRepository({
        row: {
          ...ROW,
          body: '<p>See <a href="knowledge:019e8882-07f1-771c-993e-f6825a9224bc">next</a></p><script>alert("x")</script>',
        },
      }),
    );

    const html = await service.getKnowledgeHtmlPage(ROW.id);

    expect(html).toContain('/knowledge/pages/019e8882-07f1-771c-993e-f6825a9224bc');
    expect(html).not.toContain('<script>');
  });

  it('rejects unknown referenced ids with a 400', async () => {
    const repo = new MockKnowledgeRepository({
      createResult: {
        ok: false,
        missingType: true,
        missingPersonIds: [],
        missingRecordIds: ['019e7000-0000-7000-8000-000000000099'],
      },
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
