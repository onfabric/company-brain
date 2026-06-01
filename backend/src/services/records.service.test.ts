import { describe, expect, it } from 'bun:test';
import { type IngestBatch, RecordsRepositoryContract } from '#repositories/records.repository.ts';
import { RecordsService } from '#services/records.service.ts';

class MockRecordsRepository extends RecordsRepositoryContract {
  readonly calls: IngestBatch[] = [];

  constructor(private readonly ingested: number) {
    super();
  }

  ingestBatch(batch: IngestBatch): Promise<number> {
    this.calls.push(batch);
    return Promise.resolve(this.ingested);
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
});
