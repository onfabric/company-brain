import type { IngestBatch, RecordsRepositoryContract } from '#repositories/records.repository.ts';
import { Service } from '#services/service.ts';

export class RecordsService extends Service {
  private readonly recordsRepo: RecordsRepositoryContract;

  constructor(recordsRepo: RecordsRepositoryContract) {
    super();
    this.recordsRepo = recordsRepo;
  }

  async ingestBatch(batch: IngestBatch): Promise<{ ingested: number }> {
    const ingested = await this.recordsRepo.ingestBatch(batch);
    this.logger.info(
      `ingested ${ingested}/${batch.externalIds.length} ${batch.dataSourceId} ${batch.model} record(s)`,
    );
    return { ingested };
  }
}
