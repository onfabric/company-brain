import type { SQL } from 'bun';
import type { DataSources, People, PeopleDataSources, Records } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type IngestBatch = {
  nangoIntegrationId: string;
  connectionId: number;
  model: string;
  externalIds: string[];
};

export type SourceRow = Pick<Records, 'data_source_id'> & {
  data_source_key: DataSources['nango_integration_id'];
  count: number;
  oldest_created_at: Date;
  newest_created_at: Date;
  newest_updated_at: Date;
};

export const NO_PARTICIPANTS_PERSON_ID = 'none';
export const RECORD_SORT_FIELDS = ['created_at', 'updated_at', 'relevance'] as const;
export const RECORD_SORT_ORDERS = ['asc', 'desc'] as const;
export const DEFAULT_RECORD_SORT_FIELD: RecordSortField = 'created_at';
export const DEFAULT_SEARCH_SORT_FIELD: RecordSortField = 'relevance';
export const DEFAULT_RECORD_SORT_ORDER: RecordSortOrder = 'desc';

export type RecordSortField = (typeof RECORD_SORT_FIELDS)[number];
export type RecordSortOrder = (typeof RECORD_SORT_ORDERS)[number];

export type SearchParams = {
  query?: string;
  dataSourceId?: string;
  personIds?: string[];
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sortBy?: RecordSortField;
  sortOrder?: RecordSortOrder;
  limit: number;
  offset: number;
};

export type BrowseDayFilter = {
  key: string;
  start: string;
  end: string;
};

export type BrowseRecordsParams = {
  dataSourceId?: string;
  day?: BrowseDayFilter;
  personId?: string;
  limit: number;
  offset: number;
};

export type RecordRow = Pick<
  Records,
  'id' | 'data_source_id' | 'created_at' | 'updated_at' | 'body'
> & {
  data_source_key: DataSources['nango_integration_id'];
  participants: Array<
    Pick<People, 'id' | 'name' | 'email' | 'is_external'> & {
      handle: PeopleDataSources['data_source_user_id'] | null;
    }
  >;
};

export type SearchResultRow = RecordRow & {
  score: number | null;
  snippet: string | null;
};

export type RecordFolderType = 'provider' | 'day' | 'participant';

export type RecordFolderRow = {
  type: RecordFolderType;
  id: string;
  name: string;
  count: number;
};

export type SourceIdentity = Pick<SourceRow, 'data_source_id' | 'data_source_key'>;

export type ParticipantIdentity = Pick<People, 'id' | 'name' | 'email' | 'is_external'> & {
  handle: PeopleDataSources['data_source_user_id'] | null;
};

export type SearchPage = {
  // Computed only on the first page (offset 0) so scrolling does not re-run a
  // full count for every page; null on subsequent pages.
  total: number | null;
  results: SearchResultRow[];
};

export type BrowseRecordsPage = {
  source: SourceIdentity | null;
  participant: ParticipantIdentity | null;
  total: number;
  folders: RecordFolderRow[];
  records: SearchResultRow[];
};

export abstract class RecordsRepositoryContract {
  abstract ingestBatch(batch: IngestBatch): Promise<number>;
  abstract listSources(): Promise<SourceRow[]>;
  abstract browse(params: BrowseRecordsParams): Promise<BrowseRecordsPage>;
  abstract search(params: SearchParams): Promise<SearchPage>;
  abstract getById(id: Records['id']): Promise<RecordRow | null>;
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

  listSources(): Promise<SourceRow[]> {
    return this.sql<SourceRow[]>`
      SELECT
        r.data_source_id,
        ds.nango_integration_id AS data_source_key,
        COUNT(*)::int AS count,
        MIN(r.created_at) AS oldest_created_at,
        MAX(r.created_at) AS newest_created_at,
        MAX(r.updated_at) AS newest_updated_at
      FROM brain.records r
      JOIN brain.data_sources ds ON ds.id = r.data_source_id
      GROUP BY r.data_source_id, ds.nango_integration_id
      ORDER BY ds.nango_integration_id
    `;
  }

  async browse(params: BrowseRecordsParams): Promise<BrowseRecordsPage> {
    const [source, participant] = await Promise.all([
      params.dataSourceId ? this.findSource(params.dataSourceId) : Promise.resolve(null),
      params.personId && params.personId !== NO_PARTICIPANTS_PERSON_ID
        ? this.findParticipant(params.personId, params.dataSourceId)
        : Promise.resolve(null),
    ]);

    if (!params.dataSourceId) {
      const folders = await this.listProviderFolders();
      return { source, participant, total: this.folderTotal(folders), folders, records: [] };
    }

    if (!params.day) {
      const folders = await this.listDayFolders(params.dataSourceId);
      return { source, participant, total: this.folderTotal(folders), folders, records: [] };
    }

    if (!params.personId) {
      const folders = await this.listParticipantFolders(params.dataSourceId, params.day);
      return { source, participant, total: this.folderTotal(folders), folders, records: [] };
    }

    const [records, total] = await Promise.all([
      this.listBrowserRecords(params),
      this.countBrowserRecords(params),
    ]);
    return { source, participant, total, folders: [], records };
  }

  async search(params: SearchParams): Promise<SearchPage> {
    const where = this.buildWhere(params);

    const scoreExpr = params.query ? this.sql`paradedb.score(id)` : this.sql`NULL::real`;
    const snippetExpr = params.query ? this.sql`paradedb.snippet(body)` : this.sql`NULL::text`;
    const orderBy = this.orderBy(params);
    const pageOrderBy = this.orderBy(params, 'page');

    const results = await this.sql<SearchResultRow[]>`
      WITH page AS (
        SELECT
          id,
          data_source_id,
          created_at,
          updated_at,
          body,
          ${scoreExpr} AS score,
          ${snippetExpr} AS snippet
        FROM brain.records
        ${where}
        ${orderBy}
        LIMIT ${params.limit} OFFSET ${params.offset}
      )
      SELECT
        page.id,
        page.data_source_id,
        ds.nango_integration_id AS data_source_key,
        page.created_at,
        page.updated_at,
        page.body,
        page.score,
        page.snippet,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email,
              'is_external', p.is_external,
              'handle', (
                SELECT pds.data_source_user_id
                FROM brain.people_data_sources pds
                WHERE pds.person_id = p.id
                ORDER BY pds.data_source_id, pds.data_source_user_id
                LIMIT 1
              )
            )
            ORDER BY p.name NULLS LAST, p.email NULLS LAST, p.id
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS participants
      FROM page
      JOIN brain.data_sources ds ON ds.id = page.data_source_id
      LEFT JOIN brain.records_people rp ON rp.record_id = page.id
      LEFT JOIN brain.people p ON p.id = rp.person_id
      GROUP BY
        page.id,
        page.data_source_id,
        ds.nango_integration_id,
        page.created_at,
        page.updated_at,
        page.body,
        page.score,
        page.snippet
      ${pageOrderBy}
    `;

    if (params.offset > 0) {
      return { total: null, results };
    }

    const [countRow] = await this.sql<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM brain.records ${where}
    `;

    return { total: countRow?.total ?? 0, results };
  }

  private orderBy(params: SearchParams, scope?: 'page') {
    const sortBy =
      params.sortBy ?? (params.query ? DEFAULT_SEARCH_SORT_FIELD : DEFAULT_RECORD_SORT_FIELD);
    const sortOrder = params.sortOrder ?? DEFAULT_RECORD_SORT_ORDER;
    const direction = sortOrder === 'asc' ? this.sql`ASC` : this.sql`DESC`;
    const id = scope === 'page' ? this.sql`page.id` : this.sql`id`;
    const createdAt = scope === 'page' ? this.sql`page.created_at` : this.sql`created_at`;
    const updatedAt = scope === 'page' ? this.sql`page.updated_at` : this.sql`updated_at`;

    if (sortBy === 'relevance') {
      const score = scope === 'page' ? this.sql`page.score` : this.sql`paradedb.score(id)`;
      return this
        .sql`ORDER BY ${score} ${direction}, ${updatedAt} ${direction}, ${id} ${direction}`;
    }

    if (sortBy === 'updated_at') {
      return this
        .sql`ORDER BY ${updatedAt} ${direction}, ${createdAt} ${direction}, ${id} ${direction}`;
    }

    return this
      .sql`ORDER BY ${createdAt} ${direction}, ${updatedAt} ${direction}, ${id} ${direction}`;
  }

  async getById(id: Records['id']): Promise<RecordRow | null> {
    const [row] = await this.sql<RecordRow[]>`
      SELECT
        r.id,
        r.data_source_id,
        ds.nango_integration_id AS data_source_key,
        r.created_at,
        r.updated_at,
        r.body,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email,
              'is_external', p.is_external,
              'handle', (
                SELECT pds.data_source_user_id
                FROM brain.people_data_sources pds
                WHERE pds.person_id = p.id
                ORDER BY pds.data_source_id, pds.data_source_user_id
                LIMIT 1
              )
            )
            ORDER BY p.name NULLS LAST, p.email NULLS LAST, p.id
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS participants
      FROM brain.records r
      JOIN brain.data_sources ds ON ds.id = r.data_source_id
      LEFT JOIN brain.records_people rp ON rp.record_id = r.id
      LEFT JOIN brain.people p ON p.id = rp.person_id
      WHERE r.id = ${id}
      GROUP BY r.id, r.data_source_id, ds.nango_integration_id, r.created_at, r.updated_at, r.body
    `;
    return row ?? null;
  }

  private findSource(dataSourceId: string): Promise<SourceIdentity | null> {
    return this.sql<SourceIdentity[]>`
      SELECT
        id AS data_source_id,
        nango_integration_id AS data_source_key
      FROM brain.data_sources
      WHERE id = ${dataSourceId}
    `.then((rows) => rows[0] ?? null);
  }

  private findParticipant(
    personId: string,
    dataSourceId: string | undefined,
  ): Promise<ParticipantIdentity | null> {
    return this.sql<ParticipantIdentity[]>`
      SELECT
        p.id,
        p.name,
        p.email,
        p.is_external,
        pds_handle.data_source_user_id AS handle
      FROM brain.people p
      LEFT JOIN LATERAL (
        SELECT pds.data_source_user_id
        FROM brain.people_data_sources pds
        WHERE pds.person_id = p.id
        ORDER BY
          CASE WHEN ${dataSourceId ?? null}::uuid IS NOT NULL AND pds.data_source_id = ${dataSourceId ?? null}::uuid THEN 0 ELSE 1 END,
          pds.data_source_id,
          pds.data_source_user_id
        LIMIT 1
      ) pds_handle ON TRUE
      WHERE p.id = ${personId}
    `.then((rows) => rows[0] ?? null);
  }

  private listProviderFolders(): Promise<RecordFolderRow[]> {
    return this.sql<RecordFolderRow[]>`
      SELECT
        'provider' AS type,
        ds.id AS id,
        ds.nango_integration_id AS name,
        COUNT(*)::int AS count
      FROM brain.records r
      JOIN brain.data_sources ds ON ds.id = r.data_source_id
      GROUP BY ds.id, ds.nango_integration_id
      ORDER BY ds.nango_integration_id
    `;
  }

  private listDayFolders(dataSourceId: string): Promise<RecordFolderRow[]> {
    return this.sql<RecordFolderRow[]>`
      WITH record_days AS (
        SELECT to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
        FROM brain.records r
        WHERE r.data_source_id = ${dataSourceId}
      )
      SELECT
        'day' AS type,
        day AS id,
        day AS name,
        COUNT(*)::int AS count
      FROM record_days
      GROUP BY day
      ORDER BY day DESC
    `;
  }

  private listParticipantFolders(
    dataSourceId: string,
    day: BrowseDayFilter,
  ): Promise<RecordFolderRow[]> {
    return this.sql<RecordFolderRow[]>`
      WITH scoped_records AS (
        SELECT r.id
        FROM brain.records r
        WHERE r.data_source_id = ${dataSourceId}
          AND r.created_at >= ${day.start}
          AND r.created_at < ${day.end}
      ),
      participant_folders AS (
        SELECT
          'participant' AS type,
          p.id::text AS id,
          COALESCE(p.name, p.email, pds_handle.data_source_user_id, p.id::text) AS name,
          COUNT(DISTINCT sr.id)::int AS count
        FROM scoped_records sr
        JOIN brain.records_people rp ON rp.record_id = sr.id
        JOIN brain.people p ON p.id = rp.person_id
        LEFT JOIN LATERAL (
          SELECT pds.data_source_user_id
          FROM brain.people_data_sources pds
          WHERE pds.person_id = p.id
          ORDER BY
            CASE WHEN pds.data_source_id = ${dataSourceId} THEN 0 ELSE 1 END,
            pds.data_source_id,
            pds.data_source_user_id
          LIMIT 1
        ) pds_handle ON TRUE
        GROUP BY p.id, p.name, p.email, pds_handle.data_source_user_id
      ),
      no_participants_folder AS (
        SELECT
          'participant' AS type,
          ${NO_PARTICIPANTS_PERSON_ID} AS id,
          'No participants' AS name,
          COUNT(*)::int AS count
        FROM scoped_records sr
        WHERE NOT EXISTS (
          SELECT 1 FROM brain.records_people rp WHERE rp.record_id = sr.id
        )
      )
      SELECT type, id, name, count
      FROM (
        SELECT * FROM participant_folders
        UNION ALL
        SELECT * FROM no_participants_folder WHERE count > 0
      ) folders
      ORDER BY
        CASE WHEN id = ${NO_PARTICIPANTS_PERSON_ID} THEN 1 ELSE 0 END,
        lower(name),
        id
    `;
  }

  private listBrowserRecords(params: BrowseRecordsParams): Promise<SearchResultRow[]> {
    const where = this.buildBrowseWhere(params);
    return this.sql<SearchResultRow[]>`
      WITH page AS (
        SELECT
          id,
          data_source_id,
          created_at,
          updated_at,
          body,
          NULL::real AS score,
          NULL::text AS snippet
        FROM brain.records
        ${where}
        ORDER BY created_at DESC, updated_at DESC, id DESC
        LIMIT ${params.limit} OFFSET ${params.offset}
      )
      SELECT
        page.id,
        page.data_source_id,
        ds.nango_integration_id AS data_source_key,
        page.created_at,
        page.updated_at,
        page.body,
        page.score,
        page.snippet,
        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'name', p.name,
              'email', p.email,
              'is_external', p.is_external,
              'handle', (
                SELECT pds.data_source_user_id
                FROM brain.people_data_sources pds
                WHERE pds.person_id = p.id
                ORDER BY pds.data_source_id, pds.data_source_user_id
                LIMIT 1
              )
            )
            ORDER BY p.name NULLS LAST, p.email NULLS LAST, p.id
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS participants
      FROM page
      JOIN brain.data_sources ds ON ds.id = page.data_source_id
      LEFT JOIN brain.records_people rp ON rp.record_id = page.id
      LEFT JOIN brain.people p ON p.id = rp.person_id
      GROUP BY
        page.id,
        page.data_source_id,
        ds.nango_integration_id,
        page.created_at,
        page.updated_at,
        page.body,
        page.score,
        page.snippet
      ORDER BY page.created_at DESC, page.updated_at DESC, page.id DESC
    `;
  }

  private async countBrowserRecords(params: BrowseRecordsParams): Promise<number> {
    const where = this.buildBrowseWhere(params);
    const [row] = await this.sql<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM brain.records ${where}
    `;
    return row?.total ?? 0;
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
              AND rp.person_id IN ${this.sql(params.personIds)}
          )`
        : null,
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

  private buildBrowseWhere(params: BrowseRecordsParams) {
    const conditions = [
      params.dataSourceId ? this.sql`data_source_id = ${params.dataSourceId}` : null,
      params.day ? this.sql`created_at >= ${params.day.start}` : null,
      params.day ? this.sql`created_at < ${params.day.end}` : null,
      params.personId === NO_PARTICIPANTS_PERSON_ID
        ? this.sql`NOT EXISTS (
            SELECT 1 FROM brain.records_people rp
            WHERE rp.record_id = brain.records.id
          )`
        : null,
      params.personId && params.personId !== NO_PARTICIPANTS_PERSON_ID
        ? this.sql`EXISTS (
            SELECT 1 FROM brain.records_people rp
            WHERE rp.record_id = brain.records.id
              AND rp.person_id = ${params.personId}
          )`
        : null,
    ].filter((condition) => condition !== null);

    let where = this.sql``;
    conditions.forEach((condition, index) => {
      where = index === 0 ? this.sql`WHERE ${condition}` : this.sql`${where} AND ${condition}`;
    });
    return where;
  }

  private folderTotal(folders: RecordFolderRow[]) {
    return folders.reduce((sum, folder) => sum + folder.count, 0);
  }
}
