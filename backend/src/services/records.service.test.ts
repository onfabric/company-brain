import { describe, expect, it } from 'bun:test';
import {
  type IngestBatch,
  type RecordRow,
  RecordsRepositoryContract,
  type SearchPage,
  type SearchParams,
  type SourceRow,
} from '#repositories/records.repository.ts';
import { RecordsService } from '#services/records.service.ts';

class MockRecordsRepository extends RecordsRepositoryContract {
  readonly calls: IngestBatch[] = [];
  searchCalls: SearchParams[] = [];
  getByIdCalls: string[] = [];

  constructor(
    private readonly ingested: number,
    private readonly sources: SourceRow[] = [],
    private readonly page: SearchPage = { total: 0, results: [] },
    private readonly record: RecordRow | null = null,
  ) {
    super();
  }

  ingestBatch(batch: IngestBatch): Promise<number> {
    this.calls.push(batch);
    return Promise.resolve(this.ingested);
  }

  listSources(): Promise<SourceRow[]> {
    return Promise.resolve(this.sources);
  }

  search(params: SearchParams): Promise<SearchPage> {
    this.searchCalls.push(params);
    return Promise.resolve(this.page);
  }

  getById(id: string): Promise<RecordRow | null> {
    this.getByIdCalls.push(id);
    return Promise.resolve(this.record);
  }
}

describe('RecordsService', () => {
  it('forwards the batch to the repository and returns the ingested count', async () => {
    const repo = new MockRecordsRepository(2);
    const service = new RecordsService(repo);

    const batch: IngestBatch = {
      nangoIntegrationId: 'slack',
      connectionId: 7,
      model: 'SlackThread',
      externalIds: ['a', 'b', 'c'],
    };

    const result = await service.ingestBatch(batch);

    expect(result).toEqual({ ingested: 2 });
    expect(repo.calls).toEqual([batch]);
  });

  it('maps data source rows to ISO timestamps', async () => {
    const repo = new MockRecordsRepository(0, [
      {
        data_source_id: '019e8882-07f1-771c-993e-f6825a9224bb',
        data_source_key: 'slack',
        count: 8,
        oldest_created_at: new Date('2026-01-01T00:00:00Z'),
        newest_created_at: new Date('2026-03-01T00:00:00Z'),
        newest_updated_at: new Date('2026-03-02T00:00:00Z'),
      },
      {
        data_source_id: '019e8882-07f1-77a0-b4cf-5798eafb4664',
        data_source_key: 'github',
        count: 2,
        oldest_created_at: new Date('2026-01-05T00:00:00Z'),
        newest_created_at: new Date('2026-01-06T00:00:00Z'),
        newest_updated_at: new Date('2026-01-07T00:00:00Z'),
      },
    ]);
    const service = new RecordsService(repo);

    const { sources } = await service.listSources();

    expect(sources).toEqual([
      {
        data_source_id: '019e8882-07f1-771c-993e-f6825a9224bb',
        data_source_key: 'slack',
        count: 8,
        oldest_created_at: '2026-01-01T00:00:00.000Z',
        newest_created_at: '2026-03-01T00:00:00.000Z',
        newest_updated_at: '2026-03-02T00:00:00.000Z',
      },
      {
        data_source_id: '019e8882-07f1-77a0-b4cf-5798eafb4664',
        data_source_key: 'github',
        count: 2,
        oldest_created_at: '2026-01-05T00:00:00.000Z',
        newest_created_at: '2026-01-06T00:00:00.000Z',
        newest_updated_at: '2026-01-07T00:00:00.000Z',
      },
    ]);
  });

  it('normalizes time-range filters to ISO and maps repository hits', async () => {
    const repo = new MockRecordsRepository(0, [], {
      total: 1,
      results: [
        {
          id: 'rec-1',
          data_source_id: '019e8882-07f1-771c-993e-f6825a9224bb',
          data_source_key: 'slack',
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-02T00:00:00Z'),
          body: 'hello world',
          participants: [
            {
              id: '019e8882-07f1-77a0-b4cf-5798eafb4664',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              is_external: false,
            },
          ],
          score: 4.2,
          snippet: '<b>hello</b> world',
        },
      ],
    });
    const service = new RecordsService(repo);

    const result = await service.search({
      query: 'hello',
      dataSourceId: '019e8882-07f1-771c-993e-f6825a9224bb',
      updatedAfter: '2026-01-01',
      limit: 10,
      offset: 0,
    });

    expect(repo.searchCalls[0]?.updatedAfter).toBe('2026-01-01T00:00:00.000Z');
    expect(result).toEqual({
      total: 1,
      limit: 10,
      offset: 0,
      results: [
        {
          id: 'rec-1',
          data_source_id: '019e8882-07f1-771c-993e-f6825a9224bb',
          data_source_key: 'slack',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
          score: 4.2,
          snippet: '<b>hello</b> world',
          body: 'hello world',
          participants: [
            {
              id: '019e8882-07f1-77a0-b4cf-5798eafb4664',
              name: 'Ada Lovelace',
              email: 'ada@example.com',
              is_external: false,
            },
          ],
        },
      ],
    });
  });

  it('forwards the person filter to the repository', async () => {
    const repo = new MockRecordsRepository(0);
    const service = new RecordsService(repo);

    const personIds = [
      '019e8882-07f1-771c-993e-f6825a9224bb',
      '019e8882-07f1-77a0-b4cf-5798eafb4664',
    ];
    await service.search({ personIds, limit: 20, offset: 0 });

    expect(repo.searchCalls[0]?.personIds).toEqual(personIds);
  });

  it('forwards record sort params to the repository', async () => {
    const repo = new MockRecordsRepository(0);
    const service = new RecordsService(repo);

    await service.search({ sortBy: 'updated_at', sortOrder: 'asc', limit: 20, offset: 0 });

    expect(repo.searchCalls[0]?.sortBy).toBe('updated_at');
    expect(repo.searchCalls[0]?.sortOrder).toBe('asc');
  });

  it('rejects relevance sorting without a full-text query', async () => {
    const repo = new MockRecordsRepository(0);
    const service = new RecordsService(repo);

    await expect(service.search({ sortBy: 'relevance', limit: 20, offset: 0 })).rejects.toThrow(
      'sort_by=relevance requires q',
    );
  });

  it('rejects an unparseable time-range filter with a 400', async () => {
    const repo = new MockRecordsRepository(0);
    const service = new RecordsService(repo);

    await expect(
      service.search({ createdAfter: 'not-a-date', limit: 20, offset: 0 }),
    ).rejects.toThrow('Invalid created_after timestamp: not-a-date');
  });

  it('maps a record fetched by id', async () => {
    const repo = new MockRecordsRepository(
      0,
      [],
      { total: 0, results: [] },
      {
        id: '019e8882-07f1-771c-993e-f6825a9224bb',
        data_source_id: '019e8882-07f1-77a0-b4cf-5798eafb4664',
        data_source_key: 'github',
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
        body: 'hello world',
        participants: [],
      },
    );
    const service = new RecordsService(repo);

    const record = await service.getRecord('019e8882-07f1-771c-993e-f6825a9224bb');

    expect(repo.getByIdCalls).toEqual(['019e8882-07f1-771c-993e-f6825a9224bb']);
    expect(record).toEqual({
      id: '019e8882-07f1-771c-993e-f6825a9224bb',
      data_source_id: '019e8882-07f1-77a0-b4cf-5798eafb4664',
      data_source_key: 'github',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      body: 'hello world',
      participants: [],
    });
  });

  it('throws a 404 when the record does not exist', async () => {
    const repo = new MockRecordsRepository(0);
    const service = new RecordsService(repo);

    await expect(service.getRecord('019e8882-07f1-771c-993e-f6825a9224bb')).rejects.toThrow(
      'Record not found: 019e8882-07f1-771c-993e-f6825a9224bb',
    );
  });
});
