import { BadRequestError } from '#lib/errors.ts';
import type {
  IngestBatch,
  RecordsRepositoryContract,
  SearchParams,
} from '#repositories/records.repository.ts';
import { Service } from '#services/service.ts';

type SourceModel = {
  model: string;
  count: number;
  oldest_created_at: string;
  newest_created_at: string;
  newest_updated_at: string;
};

type Source = {
  data_source_id: string;
  count: number;
  models: SourceModel[];
};

type SearchHit = {
  id: string;
  data_source_id: string;
  model: string;
  created_at: string;
  updated_at: string;
  score: number | null;
  snippet: string | null;
  body: string;
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
      `ingested ${ingested}/${batch.externalIds.length} ${batch.dataSourceId} ${batch.model} record(s)`,
    );
    return { ingested };
  }

  async listSources(): Promise<{ sources: Source[] }> {
    const rows = await this.recordsRepo.listSourceModels();
    const sources = new Map<string, Source>();

    for (const row of rows) {
      let source = sources.get(row.data_source_id);
      if (!source) {
        source = { data_source_id: row.data_source_id, count: 0, models: [] };
        sources.set(row.data_source_id, source);
      }
      source.count += row.count;
      source.models.push({
        model: row.nango_model,
        count: row.count,
        oldest_created_at: row.oldest_created_at.toISOString(),
        newest_created_at: row.newest_created_at.toISOString(),
        newest_updated_at: row.newest_updated_at.toISOString(),
      });
    }

    return { sources: [...sources.values()] };
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
        id: row.id,
        data_source_id: row.data_source_id,
        model: row.nango_model,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        score: row.score,
        snippet: row.snippet,
        body: row.body,
      })),
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
