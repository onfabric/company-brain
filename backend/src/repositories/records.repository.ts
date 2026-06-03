import type { SQL } from 'bun';
import type { DataSources, Records } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type IngestBatch = {
  nangoIntegrationId: string;
  connectionId: number;
  model: string;
  externalIds: string[];
};

export type SourceModelRow = Pick<Records, 'data_source_id' | 'nango_model'> & {
  data_source_key: DataSources['nango_integration_id'];
  count: number;
  oldest_created_at: Date;
  newest_created_at: Date;
  newest_updated_at: Date;
};

export type SearchParams = {
  query?: string;
  dataSourceId?: string;
  personIds?: string[];
  model?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit: number;
  offset: number;
};

export type SearchResultRow = Pick<
  Records,
  'id' | 'data_source_id' | 'nango_model' | 'created_at' | 'updated_at' | 'body'
> & {
  score: number | null;
  snippet: string | null;
};

export type SearchPage = {
  total: number;
  results: SearchResultRow[];
};

export abstract class RecordsRepositoryContract {
  abstract ingestBatch(batch: IngestBatch): Promise<number>;
  abstract listSourceModels(): Promise<SourceModelRow[]>;
  abstract search(params: SearchParams): Promise<SearchPage>;
}

export class RecordsRepository extends Repository implements RecordsRepositoryContract {
  async ingestBatch(batch: IngestBatch): Promise<number> {
    if (batch.externalIds.length === 0) {
      return 0;
    }

    return await this.sql.begin(async (tx) => {
      const [dataSource] = await tx<Pick<DataSources, 'id'>[]>`
        INSERT INTO brain.data_sources (nango_integration_id)
        VALUES (${batch.nangoIntegrationId})
        ON CONFLICT (nango_integration_id)
          DO UPDATE SET nango_integration_id = brain.data_sources.nango_integration_id
        RETURNING id
      `;
      if (!dataSource) {
        throw new Error('failed to upsert data source');
      }
      const dataSourceId = dataSource.id;

      const ingested = await tx<Pick<Records, 'id'>[]>`
        WITH source AS (${this.sourceRecords(tx, batch)})
        INSERT INTO brain.records (
          created_at,
          updated_at,
          data_source_id,
          nango_connection_id,
          nango_model,
          nango_id,
          body
        )
        SELECT
          (data->>'created_at')::timestamptz AS created_at,
          COALESCE((data->>'updated_at')::timestamptz, (data->>'created_at')::timestamptz) AS updated_at,
          ${dataSourceId} AS data_source_id,
          connection_id AS nango_connection_id,
          model AS nango_model,
          id AS nango_id,
          data->>'body' AS body
        FROM source
        WHERE data ? 'body'
          AND data ? 'created_at'
        ON CONFLICT (nango_connection_id, nango_model, nango_id) DO UPDATE SET
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          data_source_id = EXCLUDED.data_source_id,
          body = EXCLUDED.body
        RETURNING id
      `;

      if (ingested.length > 0) {
        await this.linkParticipants(tx, batch, dataSourceId);
      }

      return ingested.length;
    });
  }

  // The nango records + their JSON body for this batch. Built fresh per query so
  // it can be inlined as a CTE in each statement of ingestBatch.
  private sourceRecords(tx: SQL, batch: IngestBatch) {
    return tx`
      SELECT
        r.connection_id,
        r.model,
        r.id,
        rd.data
      FROM nango_records.records r
      JOIN nango_records.records_data rd
        ON rd.connection_id = r.connection_id
        AND rd.model = r.model
        AND rd.id = r.id
      WHERE r.connection_id = ${batch.connectionId}
        AND r.model = ${batch.model}
        AND r.external_id IN ${tx(batch.externalIds)}
        AND r.deleted_at IS NULL
    `;
  }

  // Resolve each record's `participants` (per-source user identifiers) to a person
  // and refresh brain.records_people for the batch. Unknown identifiers get a new
  // person with name/email left NULL, to be filled in manually later.
  private async linkParticipants(
    tx: SQL,
    batch: IngestBatch,
    dataSourceId: DataSources['id'],
  ): Promise<void> {
    // Data-modifying CTEs do not see each other's writes, so people creation,
    // link clearing, and link insertion run as separate statements: each later
    // statement reads the mappings the previous one committed.
    await tx`
      WITH source AS (${this.sourceRecords(tx, batch)}),
      user_ids AS (
        SELECT DISTINCT jsonb_array_elements_text(data->'participants') AS data_source_user_id
        FROM source
        WHERE data ? 'participants'
      ),
      missing AS (
        SELECT u.data_source_user_id, uuidv7() AS person_id
        FROM user_ids u
        WHERE NOT EXISTS (
          SELECT 1 FROM brain.people_data_sources pds
          WHERE pds.data_source_id = ${dataSourceId}
            AND pds.data_source_user_id = u.data_source_user_id
        )
      ),
      created_people AS (
        INSERT INTO brain.people (id)
        SELECT person_id FROM missing
        RETURNING id
      )
      INSERT INTO brain.people_data_sources (person_id, data_source_id, data_source_user_id)
      SELECT person_id, ${dataSourceId}, data_source_user_id FROM missing
      ON CONFLICT (data_source_id, data_source_user_id) DO NOTHING
    `;

    await tx`
      WITH source AS (${this.sourceRecords(tx, batch)})
      DELETE FROM brain.records_people
      WHERE record_id IN (
        SELECT rec.id
        FROM source s
        JOIN brain.records rec
          ON rec.nango_connection_id = s.connection_id
          AND rec.nango_model = s.model
          AND rec.nango_id = s.id
      )
    `;

    await tx`
      WITH source AS (${this.sourceRecords(tx, batch)}),
      pairs AS (
        SELECT
          rec.id AS record_id,
          jsonb_array_elements_text(s.data->'participants') AS data_source_user_id
        FROM source s
        JOIN brain.records rec
          ON rec.nango_connection_id = s.connection_id
          AND rec.nango_model = s.model
          AND rec.nango_id = s.id
        WHERE s.data ? 'participants'
      )
      INSERT INTO brain.records_people (record_id, person_id)
      SELECT DISTINCT p.record_id, pds.person_id
      FROM pairs p
      JOIN brain.people_data_sources pds
        ON pds.data_source_id = ${dataSourceId}
        AND pds.data_source_user_id = p.data_source_user_id
      ON CONFLICT (record_id, person_id) DO NOTHING
    `;
  }

  listSourceModels(): Promise<SourceModelRow[]> {
    return this.sql<SourceModelRow[]>`
      SELECT
        r.data_source_id,
        ds.nango_integration_id AS data_source_key,
        r.nango_model,
        COUNT(*)::int AS count,
        MIN(r.created_at) AS oldest_created_at,
        MAX(r.created_at) AS newest_created_at,
        MAX(r.updated_at) AS newest_updated_at
      FROM brain.records r
      JOIN brain.data_sources ds ON ds.id = r.data_source_id
      GROUP BY r.data_source_id, ds.nango_integration_id, r.nango_model
      ORDER BY ds.nango_integration_id, r.nango_model
    `;
  }

  async search(params: SearchParams): Promise<SearchPage> {
    const where = this.buildWhere(params);

    const scoreExpr = params.query ? this.sql`paradedb.score(id)` : this.sql`NULL::real`;
    const snippetExpr = params.query ? this.sql`paradedb.snippet(body)` : this.sql`NULL::text`;
    const orderBy = params.query
      ? this.sql`ORDER BY paradedb.score(id) DESC, updated_at DESC`
      : this.sql`ORDER BY updated_at DESC`;

    const results = await this.sql<SearchResultRow[]>`
      SELECT
        id,
        data_source_id,
        nango_model,
        created_at,
        updated_at,
        body,
        ${scoreExpr} AS score,
        ${snippetExpr} AS snippet
      FROM brain.records
      ${where}
      ${orderBy}
      LIMIT ${params.limit} OFFSET ${params.offset}
    `;

    const [countRow] = await this.sql<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM brain.records ${where}
    `;

    return { total: countRow?.total ?? 0, results };
  }

  // Most conditions target bm25 fast fields and are pushed down into the index
  // whether or not a full-text `query` is present. The person filter is a
  // relational semi-join on brain.records_people, applied as a filter above the
  // scan; it matches records linked to any of the given people.
  private buildWhere(params: SearchParams) {
    const conditions = [
      params.query ? this.sql`body @@@ ${params.query}` : null,
      params.dataSourceId ? this.sql`data_source_id = ${params.dataSourceId}` : null,
      params.personIds && params.personIds.length > 0
        ? this.sql`EXISTS (
            SELECT 1 FROM brain.records_people rp
            WHERE rp.record_id = brain.records.id
              AND rp.person_id = ANY(${params.personIds}::uuid[])
          )`
        : null,
      params.model ? this.sql`nango_model = ${params.model}` : null,
      params.createdAfter ? this.sql`created_at >= ${params.createdAfter}` : null,
      params.createdBefore ? this.sql`created_at < ${params.createdBefore}` : null,
      params.updatedAfter ? this.sql`updated_at >= ${params.updatedAfter}` : null,
      params.updatedBefore ? this.sql`updated_at < ${params.updatedBefore}` : null,
    ].filter((condition) => condition !== null);

    let where = this.sql``;
    conditions.forEach((condition, index) => {
      where = index === 0 ? this.sql`WHERE ${condition}` : this.sql`${where} AND ${condition}`;
    });
    return where;
  }
}
