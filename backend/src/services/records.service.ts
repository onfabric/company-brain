import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import type {
  IngestBatch,
  RecordRow,
  RecordsRepositoryContract,
  SearchParams,
} from '#repositories/records.repository.ts';
import { Service } from '#services/service.ts';

type Source = {
  data_source_id: string;
  data_source_key: string;
  count: number;
  oldest_created_at: string;
  newest_created_at: string;
  newest_updated_at: string;
};

type Record = {
  id: string;
  data_source_id: string;
  data_source_key: string;
  created_at: string;
  updated_at: string;
  body: string;
  participants: Array<{
    id: string;
    name: string | null;
    email: string | null;
    is_external: boolean;
  }>;
};

type SearchHit = Record & {
  score: number | null;
  snippet: string | null;
};

export class RecordsService extends Service {
  private readonly recordsRepo: RecordsRepositoryContract;

  constructor(recordsRepo: RecordsRepositoryContract) {
    super();
    this.recordsRepo = recordsRepo;
  }

  async ingestBatch(batch: IngestBatch): Promise<{ ingested: number }> {
    const ingested = await this.recordsRepo.ingestBatch(batch);
    this.logger.info(
      `ingested ${ingested}/${batch.externalIds.length} ${batch.nangoIntegrationId} ${batch.model} record(s)`,
    );
    return { ingested };
  }

  async listSources(): Promise<{ sources: Source[] }> {
    const rows = await this.recordsRepo.listSources();
    return {
      sources: rows.map((row) => ({
        data_source_id: row.data_source_id,
        data_source_key: row.data_source_key,
        count: row.count,
        oldest_created_at: row.oldest_created_at.toISOString(),
        newest_created_at: row.newest_created_at.toISOString(),
        newest_updated_at: row.newest_updated_at.toISOString(),
      })),
    };
  }

  async search(
    params: SearchParams,
  ): Promise<{ total: number; limit: number; offset: number; results: SearchHit[] }> {
    const { total, results } = await this.recordsRepo.search({
      ...params,
      createdAfter: this.toIso('created_after', params.createdAfter),
      createdBefore: this.toIso('created_before', params.createdBefore),
      updatedAfter: this.toIso('updated_after', params.updatedAfter),
      updatedBefore: this.toIso('updated_before', params.updatedBefore),
    });

    return {
      total,
      limit: params.limit,
      offset: params.offset,
      results: results.map((row) => ({
        ...this.toRecord(row),
        score: row.score,
        snippet: row.snippet,
      })),
    };
  }

  async getRecord(id: string): Promise<Record> {
    const row = await this.recordsRepo.getById(id);
    if (!row) {
      throw new NotFoundError(`Record not found: ${id}`);
    }
    return this.toRecord(row);
  }

  private toRecord(row: RecordRow): Record {
    return {
      id: row.id,
      data_source_id: row.data_source_id,
      data_source_key: row.data_source_key,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      body: row.body,
      participants: row.participants,
    };
  }

  private toIso(label: string, value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestError(`Invalid ${label} timestamp: ${value}`);
    }
    return parsed.toISOString();
  }
}
