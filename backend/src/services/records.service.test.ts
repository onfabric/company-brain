import { describe, expect, it } from 'bun:test';
import {
  type IngestBatch,
  RecordsRepositoryContract,
  type SearchPage,
  type SearchParams,
  type SourceModelRow,
} from '#repositories/records.repository.ts';
import { RecordsService } from '#services/records.service.ts';

class MockRecordsRepository extends RecordsRepositoryContract {
  readonly calls: IngestBatch[] = [];
  searchCalls: SearchParams[] = [];

  constructor(
    private readonly ingested: number,
    private readonly sourceModels: SourceModelRow[] = [],
    private readonly page: SearchPage = { total: 0, results: [] },
  ) {
    super();
  }

  ingestBatch(batch: IngestBatch): Promise<number> {
    this.calls.push(batch);
    return Promise.resolve(this.ingested);
  }

  listSourceModels(): Promise<SourceModelRow[]> {
    return Promise.resolve(this.sourceModels);
  }

  search(params: SearchParams): Promise<SearchPage> {
    this.searchCalls.push(params);
    return Promise.resolve(this.page);
  }
}

describe('RecordsService', () => {
  it('forwards the batch to the repository and returns the ingested count', async () => {
    const repo = new MockRecordsRepository(2);
    const service = new RecordsService(repo);

    const batch: IngestBatch = {
      dataSourceId: 'slack',
      connectionId: 7,
      model: 'SlackThread',
      externalIds: ['a', 'b', 'c'],
    };

    const result = await service.ingestBatch(batch);

    expect(result).toEqual({ ingested: 2 });
    expect(repo.calls).toEqual([batch]);
  });

  it('groups source/model rows into one entry per data source', async () => {
    const repo = new MockRecordsRepository(0, [
      {
        nango_integration_id: 'slack',
        nango_model: 'SlackThread',
        count: 3,
        oldest_created_at: new Date('2026-01-01T00:00:00Z'),
        newest_created_at: new Date('2026-02-01T00:00:00Z'),
        newest_updated_at: new Date('2026-02-02T00:00:00Z'),
      },
      {
        nango_integration_id: 'slack',
        nango_model: 'SlackMessage',
        count: 5,
        oldest_created_at: new Date('2026-01-03T00:00:00Z'),
        newest_created_at: new Date('2026-03-01T00:00:00Z'),
        newest_updated_at: new Date('2026-03-02T00:00:00Z'),
      },
      {
        nango_integration_id: 'github',
        nango_model: 'Issue',
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
        data_source_id: 'slack',
        count: 8,
        models: [
          {
            model: 'SlackThread',
            count: 3,
            oldest_created_at: '2026-01-01T00:00:00.000Z',
            newest_created_at: '2026-02-01T00:00:00.000Z',
            newest_updated_at: '2026-02-02T00:00:00.000Z',
          },
          {
            model: 'SlackMessage',
            count: 5,
            oldest_created_at: '2026-01-03T00:00:00.000Z',
            newest_created_at: '2026-03-01T00:00:00.000Z',
            newest_updated_at: '2026-03-02T00:00:00.000Z',
          },
        ],
      },
      {
        data_source_id: 'github',
        count: 2,
        models: [
          {
            model: 'Issue',
            count: 2,
            oldest_created_at: '2026-01-05T00:00:00.000Z',
            newest_created_at: '2026-01-06T00:00:00.000Z',
            newest_updated_at: '2026-01-07T00:00:00.000Z',
          },
        ],
      },
    ]);
  });

  it('normalizes time-range filters to ISO and maps repository hits', async () => {
    const repo = new MockRecordsRepository(0, [], {
      total: 1,
      results: [
        {
          id: 'rec-1',
          nango_integration_id: 'slack',
          nango_model: 'SlackThread',
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-02T00:00:00Z'),
          body: 'hello world',
          score: 4.2,
          snippet: '<b>hello</b> world',
        },
      ],
    });
    const service = new RecordsService(repo);

    const result = await service.search({
      query: 'hello',
      dataSourceId: 'slack',
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
          data_source_id: 'slack',
          model: 'SlackThread',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
          score: 4.2,
          snippet: '<b>hello</b> world',
          body: 'hello world',
        },
      ],
    });
  });

  it('rejects an unparseable time-range filter with a 400', async () => {
    const repo = new MockRecordsRepository(0);
    const service = new RecordsService(repo);

    await expect(
      service.search({ createdAfter: 'not-a-date', limit: 20, offset: 0 }),
    ).rejects.toThrow('Invalid created_after timestamp: not-a-date');
  });
});
