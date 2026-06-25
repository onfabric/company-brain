import type { QueryResults, TypedTransactionSQL } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import { Repository } from '#repositories/repository.ts';

type SqlFragment = SQL.Query<unknown>;

export const KNOWLEDGE_SORT_FIELDS = ['created_at', 'relevance'] as const;
export const KNOWLEDGE_SORT_ORDERS = ['asc', 'desc'] as const;
export const KNOWLEDGE_RESULT_VIEWS = ['preview', 'full'] as const;

export type KnowledgeSortField = (typeof KNOWLEDGE_SORT_FIELDS)[number];
export type KnowledgeSortOrder = (typeof KNOWLEDGE_SORT_ORDERS)[number];
export type KnowledgeResultView = (typeof KNOWLEDGE_RESULT_VIEWS)[number];
export type KnowledgeTypeName = string;

export const DEFAULT_KNOWLEDGE_SORT_FIELD: KnowledgeSortField = 'created_at';
export const DEFAULT_KNOWLEDGE_SEARCH_SORT_FIELD: KnowledgeSortField = 'relevance';
export const DEFAULT_KNOWLEDGE_SORT_ORDER: KnowledgeSortOrder = 'desc';
export const DEFAULT_KNOWLEDGE_RESULT_VIEW: KnowledgeResultView = 'preview';

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

export type KnowledgeRow = QueryResults['SelectKnowledge'];

export type KnowledgeHitRow = QueryResults['SearchKnowledgeFull'];

export type KnowledgePreviewRow = QueryResults['SearchKnowledgePreview'];

export type KnowledgePreviewSearchPage = {
  total: number | null;
  results: KnowledgePreviewRow[];
};

export type KnowledgeFullSearchPage = {
  total: number | null;
  results: KnowledgeHitRow[];
};

type KnowledgeFields = Pick<KnowledgeRow, 'title' | 'body' | 'knowledge_type_id'>;

export type CreateKnowledgeInput = KnowledgeFields & {
  personIds: string[];
  recordIds: string[];
};

export type CreateKnowledgeResult =
  | { ok: true; id: string }
  | {
      ok: false;
      missingType: boolean;
      missingPersonIds: string[];
      missingRecordIds: string[];
    };

export type UpdateKnowledgeInput = Partial<KnowledgeFields> & {
  personIds?: string[];
  recordIds?: string[];
};

export type UpdateKnowledgeResult =
  | { ok: true; id: string }
  | { ok: false; notFound: true }
  | {
      ok: false;
      notFound: false;
      missingType: boolean;
      missingPersonIds: string[];
      missingRecordIds: string[];
    };

export abstract class KnowledgeRepositoryContract {
  abstract searchPreview(params: KnowledgeSearchParams): Promise<KnowledgePreviewSearchPage>;
  abstract searchFull(params: KnowledgeSearchParams): Promise<KnowledgeFullSearchPage>;
  abstract getById(id: string): Promise<KnowledgeRow | null>;
  abstract getByKnowledgeTypeName(name: KnowledgeTypeName): Promise<KnowledgeRow[]>;
  abstract create(input: CreateKnowledgeInput): Promise<CreateKnowledgeResult>;
  abstract update(id: string, input: UpdateKnowledgeInput): Promise<UpdateKnowledgeResult>;
  abstract remove(id: string): Promise<string | null>;
}

export class KnowledgeRepository extends Repository implements KnowledgeRepositoryContract {
  async searchPreview(params: KnowledgeSearchParams): Promise<KnowledgePreviewSearchPage> {
    const where = this.buildWhere(params);
    const scoreExpr = params.query ? this.sql`paradedb.score(id)` : this.sql`NULL::real`;

    const results = await this.sql.SearchKnowledgePreview`
      /* @notNull id */
      /* @notNull title */
      WITH page AS (
        SELECT
          id,
          title,
          ${scoreExpr} AS score
        FROM brain.knowledge
        ${where}
        ${this.orderBy(params)}
        LIMIT ${params.limit} OFFSET ${params.offset}
      )
      SELECT
        page.id,
        page.title
      FROM page
      ${this.orderBy(params, 'page')}
    `;

    return { total: await this.count(where, params.offset), results };
  }

  async searchFull(params: KnowledgeSearchParams): Promise<KnowledgeFullSearchPage> {
    const where = this.buildWhere(params);
    const scoreExpr = params.query ? this.sql`paradedb.score(id)` : this.sql`NULL::real`;
    const snippetExpr = params.query ? this.sql`paradedb.snippet(body)` : this.sql`NULL::text`;

    const results = await this.sql.SearchKnowledgeFull`
      /* @type participants Array<import('#repositories/participant.ts').Participant> */
      /* @type source_record_ids string[] */
      /* @type score number | null */
      /* @type snippet string | null */
      /* @notNull knowledge_type_name */
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

    return { total: await this.count(where, params.offset), results };
  }

  getById(id: string): Promise<KnowledgeRow | null> {
    return this.getOne(this.sql`k.id = ${id}`);
  }

  getByKnowledgeTypeName(name: KnowledgeTypeName): Promise<KnowledgeRow[]> {
    return this.getMany(this.sql`lower(kt.name) = lower(${name})`, 2);
  }

  create(input: CreateKnowledgeInput): Promise<CreateKnowledgeResult> {
    return this.sql.begin(async (tx) => {
      const [type] = await this.knowledgeTypeExists(tx, input.knowledge_type_id);
      const missingPersonIds = await this.missingPeople(tx, input.personIds);
      const missingRecordIds = await this.missingRecords(tx, input.recordIds);

      if (!type || missingPersonIds.length > 0 || missingRecordIds.length > 0) {
        return { ok: false, missingType: !type, missingPersonIds, missingRecordIds };
      }

      const [created] = await tx.InsertKnowledge`
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

  update(id: string, input: UpdateKnowledgeInput): Promise<UpdateKnowledgeResult> {
    return this.sql.begin(async (tx) => {
      const [existing] = await tx.KnowledgeExists`
        SELECT true AS exists FROM brain.knowledge WHERE id = ${id}
      `;
      if (!existing) {
        return { ok: false, notFound: true };
      }

      let missingType = false;
      if (input.knowledge_type_id !== undefined) {
        const [type] = await this.knowledgeTypeExists(tx, input.knowledge_type_id);
        missingType = !type;
      }
      const missingPersonIds = input.personIds ? await this.missingPeople(tx, input.personIds) : [];
      const missingRecordIds = input.recordIds
        ? await this.missingRecords(tx, input.recordIds)
        : [];

      if (missingType || missingPersonIds.length > 0 || missingRecordIds.length > 0) {
        return { ok: false, notFound: false, missingType, missingPersonIds, missingRecordIds };
      }

      const columns: Partial<KnowledgeFields> = {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.body !== undefined && { body: input.body }),
        ...(input.knowledge_type_id !== undefined && {
          knowledge_type_id: input.knowledge_type_id,
        }),
      };

      // The set_updated_at trigger bumps updated_at on any UPDATE, so when only
      // links change we still touch the row to keep updated_at meaningful.
      if (Object.keys(columns).length > 0) {
        await tx`UPDATE brain.knowledge SET ${tx(columns)} WHERE id = ${id}`;
      } else {
        await tx`UPDATE brain.knowledge SET updated_at = now() WHERE id = ${id}`;
      }

      if (input.personIds !== undefined) {
        await tx`DELETE FROM brain.knowledge_people WHERE knowledge_id = ${id}`;
        if (input.personIds.length > 0) {
          await tx`
            INSERT INTO brain.knowledge_people ${tx(
              input.personIds.map((person_id) => ({ knowledge_id: id, person_id })),
            )}
          `;
        }
      }
      if (input.recordIds !== undefined) {
        await tx`DELETE FROM brain.knowledge_records WHERE knowledge_id = ${id}`;
        if (input.recordIds.length > 0) {
          await tx`
            INSERT INTO brain.knowledge_records ${tx(
              input.recordIds.map((record_id) => ({ knowledge_id: id, record_id })),
            )}
          `;
        }
      }

      return { ok: true, id };
    });
  }

  remove(id: string): Promise<string | null> {
    return this.sql.begin(async (tx) => {
      await tx`DELETE FROM brain.knowledge_people WHERE knowledge_id = ${id}`;
      await tx`DELETE FROM brain.knowledge_records WHERE knowledge_id = ${id}`;
      const [row] = await tx.DeleteKnowledge`
        DELETE FROM brain.knowledge WHERE id = ${id} RETURNING id
      `;
      return row?.id ?? null;
    });
  }

  private async getOne(condition: SqlFragment): Promise<KnowledgeRow | null> {
    const [row] = await this.getMany(condition, 1);
    return row ?? null;
  }

  private async getMany(condition: SqlFragment, limit: number): Promise<KnowledgeRow[]> {
    return await this.sql.SelectKnowledge`
      /* @type participants Array<import('#repositories/participant.ts').Participant> */
      /* @type source_record_ids string[] */
      /* @notNull knowledge_type_name */
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
      WHERE ${condition}
      ORDER BY k.id
      LIMIT ${limit}
    `;
  }

  private knowledgeTypeExists(tx: TypedTransactionSQL, id: string) {
    return tx.KnowledgeTypeExists`
      SELECT true AS exists FROM brain.knowledge_types WHERE id = ${id}
    `;
  }

  private async missingPeople(tx: TypedTransactionSQL, ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const present = await tx.SelectExistingPeopleIds`
      SELECT id FROM brain.people WHERE id IN ${tx(ids)}
    `;
    const found = new Set(present.map((row) => row.id));
    return ids.filter((id) => !found.has(id));
  }

  private async missingRecords(tx: TypedTransactionSQL, ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const present = await tx.SelectExistingRecordIds`
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

  private async count(where: SqlFragment, offset: number): Promise<number | null> {
    if (offset > 0) {
      return null;
    }

    const [countRow] = await this.sql.CountKnowledge`
      /* @notNull total */
      SELECT COUNT(*)::int AS total FROM brain.knowledge ${where}
    `;
    return countRow?.total ?? 0;
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
