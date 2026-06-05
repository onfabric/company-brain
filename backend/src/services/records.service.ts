import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import type {
  BrowseRecordsParams,
  IngestBatch,
  RecordRow,
  RecordsRepositoryContract,
  SearchParams,
} from '#repositories/records.repository.ts';
import { NO_PARTICIPANTS_PERSON_ID } from '#repositories/records.repository.ts';
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
    handle: string | null;
  }>;
};

type SearchHit = Record & {
  score: number | null;
  snippet: string | null;
};

type RecordFolder = {
  type: 'provider' | 'day' | 'participant';
  id: string;
  name: string;
  count: number;
};

type BrowseParams = {
  dataSourceId?: string;
  day?: string;
  personId?: string;
  limit: number;
  offset: number;
};

type BrowseResponse = {
  path: {
    data_source_id?: string;
    data_source_key?: string;
    day?: string;
    person_id?: string;
    participant_name?: string;
  };
  total: number;
  limit: number;
  offset: number;
  folders: RecordFolder[];
  records: SearchHit[];
};

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

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

  async browse(params: BrowseParams): Promise<BrowseResponse> {
    if (params.day && !params.dataSourceId) {
      throw new BadRequestError('day requires data_source_id');
    }
    if (params.personId && (!params.dataSourceId || !params.day)) {
      throw new BadRequestError('person_id requires data_source_id and day');
    }
    if (params.personId && !this.isBrowserPersonId(params.personId)) {
      throw new BadRequestError(`Invalid person_id: ${params.personId}`);
    }

    const browseParams: BrowseRecordsParams = {
      dataSourceId: params.dataSourceId,
      day: params.day ? this.toDayFilter(params.day) : undefined,
      personId: params.personId,
      limit: params.limit,
      offset: params.offset,
    };
    const page = await this.recordsRepo.browse(browseParams);

    return {
      path: {
        data_source_id: params.dataSourceId,
        data_source_key: page.source?.data_source_key,
        day: browseParams.day?.key,
        person_id: params.personId,
        participant_name: this.browserParticipantName(params.personId, page.participant),
      },
      total: page.total,
      limit: params.limit,
      offset: params.offset,
      folders: page.folders,
      records: page.records.map((row) => ({
        ...this.toRecord(row),
        score: row.score,
        snippet: row.snippet,
      })),
    };
  }

  async search(
    params: SearchParams,
  ): Promise<{ total: number | null; limit: number; offset: number; results: SearchHit[] }> {
    if (params.sortBy === 'relevance' && !params.query) {
      throw new BadRequestError('sort_by=relevance requires q');
    }

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

  private toDayFilter(value: string) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestError(`Invalid day: ${value}`);
    }

    const end = new Date(parsed);
    end.setUTCDate(end.getUTCDate() + 1);
    return {
      key: value,
      start: parsed.toISOString(),
      end: end.toISOString(),
    };
  }

  private isBrowserPersonId(value: string) {
    return value === NO_PARTICIPANTS_PERSON_ID || UUID_PATTERN.test(value);
  }

  private browserParticipantName(
    personId: string | undefined,
    participant: { name: string | null; email: string | null; handle: string | null } | null,
  ) {
    if (!personId) {
      return undefined;
    }
    if (personId === NO_PARTICIPANTS_PERSON_ID) {
      return 'No participants';
    }
    return participant?.name ?? participant?.email ?? participant?.handle ?? personId;
  }
}
