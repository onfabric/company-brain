import type { SQL } from 'bun';
import type { Knowledge, KnowledgeTypes, People, PeopleDataSources, Records } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

type SqlFragment = SQL.Query<unknown>;

export const KNOWLEDGE_SORT_FIELDS = ['created_at', 'relevance'] as const;
export const KNOWLEDGE_SORT_ORDERS = ['asc', 'desc'] as const;

export type KnowledgeSortField = (typeof KNOWLEDGE_SORT_FIELDS)[number];
export type KnowledgeSortOrder = (typeof KNOWLEDGE_SORT_ORDERS)[number];

export const DEFAULT_KNOWLEDGE_SORT_FIELD: KnowledgeSortField = 'created_at';
export const DEFAULT_KNOWLEDGE_SEARCH_SORT_FIELD: KnowledgeSortField = 'relevance';
export const DEFAULT_KNOWLEDGE_SORT_ORDER: KnowledgeSortOrder = 'desc';

export type KnowledgeSearchParams = {
  query?: string;
  knowledgeTypeId?: string;
  personIds?: string[];
  recordId?: string;
  sortBy?: KnowledgeSortField;
  sortOrder?: KnowledgeSortOrder;
  limit: number;
  offset: number;
};

export type KnowledgeParticipant = Pick<People, 'id' | 'name' | 'email' | 'is_external'> & {
  handle: PeopleDataSources['data_source_user_id'] | null;
};

export type KnowledgeRow = Pick<
  Knowledge,
  'id' | 'created_at' | 'updated_at' | 'title' | 'body' | 'knowledge_type_id'
> & {
  knowledge_type_name: KnowledgeTypes['name'];
  participants: KnowledgeParticipant[];
  source_record_ids: Records['id'][];
};

export type KnowledgeHitRow = KnowledgeRow & {
  score: number | null;
  snippet: string | null;
};

export type KnowledgeSearchPage = {
  total: number | null;
  results: KnowledgeHitRow[];
};

export type CreateKnowledgeInput = Pick<Knowledge, 'title' | 'body' | 'knowledge_type_id'> & {
  personIds: People['id'][];
  recordIds: Records['id'][];
};

export type CreateKnowledgeResult =
  | { ok: true; id: Knowledge['id'] }
  | {
      ok: false;
      missingType: boolean;
      missingPersonIds: People['id'][];
      missingRecordIds: Records['id'][];
    };

export abstract class KnowledgeRepositoryContract {
  abstract search(params: KnowledgeSearchParams): Promise<KnowledgeSearchPage>;
  abstract getById(id: Knowledge['id']): Promise<KnowledgeRow | null>;
  abstract create(input: CreateKnowledgeInput): Promise<CreateKnowledgeResult>;
}

export class KnowledgeRepository extends Repository implements KnowledgeRepositoryContract {
  async search(params: KnowledgeSearchParams): Promise<KnowledgeSearchPage> {
    const where = this.buildWhere(params);
    const scoreExpr = params.query ? this.sql`paradedb.score(id)` : this.sql`NULL::real`;
    const snippetExpr = params.query ? this.sql`paradedb.snippet(body)` : this.sql`NULL::text`;

    const results = await this.sql<KnowledgeHitRow[]>`
      WITH page AS (
        SELECT
          id,
          created_at,
          updated_at,
          title,
          body,
          knowledge_type_id,
          ${scoreExpr} AS score,
          ${snippetExpr} AS snippet
        FROM brain.knowledge
        ${where}
        ${this.orderBy(params)}
        LIMIT ${params.limit} OFFSET ${params.offset}
      )
      SELECT
        page.id,
        page.created_at,
        page.updated_at,
        page.title,
        page.body,
        page.knowledge_type_id,
        kt.name AS knowledge_type_name,
        page.score,
        page.snippet,
        ${this.participants(this.sql`page.id`)} AS participants,
        ${this.sourceRecordIds(this.sql`page.id`)} AS source_record_ids
      FROM page
      JOIN brain.knowledge_types kt ON kt.id = page.knowledge_type_id
      ${this.orderBy(params, 'page')}
    `;

    if (params.offset > 0) {
      return { total: null, results };
    }

    const [countRow] = await this.sql<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM brain.knowledge ${where}
    `;
    return { total: countRow?.total ?? 0, results };
  }

  async getById(id: Knowledge['id']): Promise<KnowledgeRow | null> {
    const [row] = await this.sql<KnowledgeRow[]>`
      SELECT
        k.id,
        k.created_at,
        k.updated_at,
        k.title,
        k.body,
        k.knowledge_type_id,
        kt.name AS knowledge_type_name,
        ${this.participants(this.sql`k.id`)} AS participants,
        ${this.sourceRecordIds(this.sql`k.id`)} AS source_record_ids
      FROM brain.knowledge k
      JOIN brain.knowledge_types kt ON kt.id = k.knowledge_type_id
      WHERE k.id = ${id}
    `;
    return row ?? null;
  }

  create(input: CreateKnowledgeInput): Promise<CreateKnowledgeResult> {
    return this.sql.begin(async (tx) => {
      const [type] = await tx<{ exists: true }[]>`
        SELECT true AS exists FROM brain.knowledge_types WHERE id = ${input.knowledge_type_id}
      `;
      const missingPersonIds = await this.missingPeople(tx, input.personIds);
      const missingRecordIds = await this.missingRecords(tx, input.recordIds);

      if (!type || missingPersonIds.length > 0 || missingRecordIds.length > 0) {
        return { ok: false, missingType: !type, missingPersonIds, missingRecordIds };
      }

      const [created] = await tx<Pick<Knowledge, 'id'>[]>`
        INSERT INTO brain.knowledge (knowledge_type_id, title, body)
        VALUES (${input.knowledge_type_id}, ${input.title}, ${input.body})
        RETURNING id
      `;
      if (!created) {
        throw new Error('failed to insert knowledge');
      }

      if (input.personIds.length > 0) {
        await tx`
          INSERT INTO brain.knowledge_people ${tx(
            input.personIds.map((person_id) => ({ knowledge_id: created.id, person_id })),
          )}
        `;
      }
      if (input.recordIds.length > 0) {
        await tx`
          INSERT INTO brain.knowledge_records ${tx(
            input.recordIds.map((record_id) => ({ knowledge_id: created.id, record_id })),
          )}
        `;
      }

      return { ok: true, id: created.id };
    });
  }

  private async missingPeople(tx: SQL, ids: People['id'][]): Promise<People['id'][]> {
    if (ids.length === 0) {
      return [];
    }
    const present = await tx<Pick<People, 'id'>[]>`
      SELECT id FROM brain.people WHERE id IN ${tx(ids)}
    `;
    const found = new Set(present.map((row) => row.id));
    return ids.filter((id) => !found.has(id));
  }

  private async missingRecords(tx: SQL, ids: Records['id'][]): Promise<Records['id'][]> {
    if (ids.length === 0) {
      return [];
    }
    const present = await tx<Pick<Records, 'id'>[]>`
      SELECT id FROM brain.records WHERE id IN ${tx(ids)}
    `;
    const found = new Set(present.map((row) => row.id));
    return ids.filter((id) => !found.has(id));
  }

  // Each M2M is aggregated as a correlated subquery rather than a join so the
  // two of them do not multiply each other into a cartesian product.
  private participants(knowledgeId: SqlFragment) {
    return this.sql`COALESCE((
      SELECT json_agg(
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
      )
      FROM brain.knowledge_people kp
      JOIN brain.people p ON p.id = kp.person_id
      WHERE kp.knowledge_id = ${knowledgeId}
    ), '[]')`;
  }

  private sourceRecordIds(knowledgeId: SqlFragment) {
    return this.sql`COALESCE((
      SELECT json_agg(kr.record_id ORDER BY kr.record_id)
      FROM brain.knowledge_records kr
      WHERE kr.knowledge_id = ${knowledgeId}
    ), '[]')`;
  }

  private orderBy(params: KnowledgeSearchParams, scope?: 'page') {
    const sortBy =
      params.sortBy ??
      (params.query ? DEFAULT_KNOWLEDGE_SEARCH_SORT_FIELD : DEFAULT_KNOWLEDGE_SORT_FIELD);
    const direction =
      (params.sortOrder ?? DEFAULT_KNOWLEDGE_SORT_ORDER) === 'asc' ? this.sql`ASC` : this.sql`DESC`;
    const id = scope === 'page' ? this.sql`page.id` : this.sql`id`;

    if (sortBy === 'relevance') {
      const score = scope === 'page' ? this.sql`page.score` : this.sql`paradedb.score(id)`;
      return this.sql`ORDER BY ${score} ${direction}, ${id} ${direction}`;
    }

    // created_at is generated from the id, and uuidv7 ids are time-ordered, so
    // ordering by the indexed id is ordering by created_at without touching the
    // virtual column.
    return this.sql`ORDER BY ${id} ${direction}`;
  }

  private buildWhere(params: KnowledgeSearchParams) {
    const conditions = [
      params.query ? this.sql`(title @@@ ${params.query} OR body @@@ ${params.query})` : null,
      params.knowledgeTypeId ? this.sql`knowledge_type_id = ${params.knowledgeTypeId}` : null,
      params.personIds && params.personIds.length > 0
        ? this.sql`EXISTS (
            SELECT 1 FROM brain.knowledge_people kp
            WHERE kp.knowledge_id = brain.knowledge.id
              AND kp.person_id IN ${this.sql(params.personIds)}
          )`
        : null,
      params.recordId
        ? this.sql`EXISTS (
            SELECT 1 FROM brain.knowledge_records kr
            WHERE kr.knowledge_id = brain.knowledge.id
              AND kr.record_id = ${params.recordId}
          )`
        : null,
    ].filter((condition) => condition !== null);

    let where = this.sql``;
    conditions.forEach((condition, index) => {
      where = index === 0 ? this.sql`WHERE ${condition}` : this.sql`${where} AND ${condition}`;
    });
    return where;
  }
}
