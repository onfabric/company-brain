import type { QueryResults } from '@ilbertt/bun-sqlgen';
import type { SQL } from 'bun';
import { Repository } from '#repositories/repository.ts';

type SqlFragment = SQL.Query<unknown>;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type PersonRow = QueryResults['SelectPeoplePage'];

export type PersonIdentity = QueryResults['FindPeopleByIds'];

export type PersonUpdate = Partial<{
  name: string | null;
  email: string | null;
  is_external: boolean;
}>;

export const PERSON_SORT_FIELDS = ['name', 'records_count'] as const;
export const PERSON_SORT_ORDERS = ['asc', 'desc'] as const;
export type PersonSortField = (typeof PERSON_SORT_FIELDS)[number];
export type PersonSortOrder = (typeof PERSON_SORT_ORDERS)[number];

const DEFAULT_PERSON_SORT_FIELD = 'name' satisfies PersonSortField;
const DEFAULT_PERSON_SORT_ORDER = 'asc' satisfies PersonSortOrder;

export type PersonFilters = {
  isExternal?: boolean;
  // Used by MCP discovery to hide people that cannot be selected by readable name/email filters.
  hasReadableIdentity?: boolean;
  sortBy?: PersonSortField;
  sortOrder?: PersonSortOrder;
  query?: string;
  limit?: number;
  offset?: number;
};

export type MergeCounts = {
  moved_data_sources: number;
  moved_records: number;
};

export abstract class PeopleRepositoryContract {
  abstract listPeople(filters?: PersonFilters): Promise<PersonRow[]>;
  abstract countPeople(filters?: PersonFilters): Promise<number>;
  abstract getPerson(id: string): Promise<PersonRow | null>;
  abstract findByIds(ids: string[]): Promise<PersonIdentity[]>;
  abstract findByNameOrEmail(values: string[]): Promise<PersonIdentity[]>;
  abstract updatePerson(id: string, updates: PersonUpdate): Promise<PersonRow | null>;
  abstract merge(fromId: string, intoId: string): Promise<MergeCounts>;
}

export class PeopleRepository extends Repository implements PeopleRepositoryContract {
  listPeople(filters: PersonFilters = {}): Promise<PersonRow[]> {
    return this.selectPeople({
      isExternal: filters.isExternal,
      hasReadableIdentity: filters.hasReadableIdentity,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      query: filters.query,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  async countPeople(filters: PersonFilters = {}): Promise<number> {
    const where = this.whereClause(
      this.filterConditions({
        isExternal: filters.isExternal,
        hasReadableIdentity: filters.hasReadableIdentity,
        query: filters.query,
      }),
    );
    const [row] = await this.sql.CountPeople`
      SELECT COUNT(*)::int AS total FROM brain.people p ${where}
    `;
    return row?.total ?? 0;
  }

  async getPerson(id: string): Promise<PersonRow | null> {
    const [person] = await this.selectPeople({ id });
    return person ?? null;
  }

  findByIds(ids: string[]): Promise<PersonIdentity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.sql.FindPeopleByIds`
      SELECT id, name, email
      FROM brain.people
      WHERE id IN ${this.sql(ids)}
    `;
  }

  findByNameOrEmail(values: string[]): Promise<PersonIdentity[]> {
    const normalized = [...new Set(values.map((value) => value.trim().toLowerCase()))].filter(
      (value) => value.length > 0,
    );
    if (normalized.length === 0) {
      return Promise.resolve([]);
    }
    return this.sql.FindPeopleByNameOrEmail`
      SELECT id, name, email
      FROM brain.people
      WHERE (name IS NOT NULL OR email IS NOT NULL)
        AND (lower(name) IN ${this.sql(normalized)} OR lower(email) IN ${this.sql(normalized)})
      ORDER BY name ASC NULLS LAST, email ASC NULLS LAST, id ASC
    `;
  }

  async updatePerson(id: string, updates: PersonUpdate): Promise<PersonRow | null> {
    const [updated] = await this.sql.UpdatePerson`
      UPDATE brain.people
      SET ${this.sql(updates)}
      WHERE id = ${id}
      RETURNING id
    `;
    return updated ? this.getPerson(updated.id) : null;
  }

  merge(fromId: string, intoId: string): Promise<MergeCounts> {
    return this.sql.begin(async (tx) => {
      const movedDataSources = await tx.ReassignPersonDataSources`
        UPDATE brain.people_data_sources
        SET person_id = ${intoId}
        WHERE person_id = ${fromId}
        RETURNING id
      `;

      // records_people PK is (record_id, person_id), so a record already linked to
      // both people would collide when reassigned. Drop merge_from's copy for those
      // records first; the UPDATE then relabels only the non-colliding remainder.
      await tx`
        DELETE FROM brain.records_people
        WHERE person_id = ${fromId}
          AND record_id IN (
            SELECT record_id FROM brain.records_people WHERE person_id = ${intoId}
          )
      `;

      const movedRecords = await tx.ReassignPersonRecords`
        UPDATE brain.records_people
        SET person_id = ${intoId}
        WHERE person_id = ${fromId}
        RETURNING record_id
      `;

      await tx`DELETE FROM brain.people WHERE id = ${fromId}`;

      return {
        moved_data_sources: movedDataSources.length,
        moved_records: movedRecords.length,
      };
    });
  }

  // Conditions shared by the list query and the matching count. `id` is handled
  // separately by selectPeople since it is only used for single-person lookups.
  private filterConditions({
    isExternal,
    hasReadableIdentity,
    query,
  }: {
    isExternal?: boolean;
    hasReadableIdentity?: boolean;
    query?: string;
  }): SqlFragment[] {
    const conditions: SqlFragment[] = [];
    if (isExternal !== undefined) {
      conditions.push(this.sql`p.is_external = ${isExternal}`);
    }
    if (hasReadableIdentity) {
      conditions.push(this.sql`(p.name IS NOT NULL OR p.email IS NOT NULL)`);
    }
    const trimmedQuery = query?.trim();
    if (trimmedQuery) {
      // Match on name/email, or on any of the person's per-source handles. The
      // handle match is an EXISTS so the data_sources aggregate below stays
      // complete rather than being narrowed to the matching row.
      const pattern = `%${escapeLike(trimmedQuery)}%`;
      conditions.push(this.sql`(
        p.name ILIKE ${pattern} ESCAPE '\\'
        OR p.email ILIKE ${pattern} ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM brain.people_data_sources pds_q
          WHERE pds_q.person_id = p.id
            AND pds_q.data_source_user_id ILIKE ${pattern} ESCAPE '\\'
        )
      )`);
    }
    return conditions;
  }

  private whereClause(conditions: SqlFragment[]) {
    return conditions.length
      ? this.sql`WHERE ${conditions.reduce((acc, cond) => this.sql`${acc} AND ${cond}`)}`
      : this.sql``;
  }

  private selectPeople({
    id,
    isExternal,
    hasReadableIdentity,
    sortBy,
    sortOrder,
    query,
    limit,
    offset,
  }: {
    id?: string;
    isExternal?: boolean;
    hasReadableIdentity?: boolean;
    sortBy?: PersonSortField;
    sortOrder?: PersonSortOrder;
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PersonRow[]> {
    const conditions: SqlFragment[] =
      id !== undefined
        ? [this.sql`p.id = ${id}`]
        : this.filterConditions({ isExternal, hasReadableIdentity, query });
    const where = this.whereClause(conditions);
    const limitClause = limit !== undefined ? this.sql`LIMIT ${limit}` : this.sql``;
    const offsetClause = offset ? this.sql`OFFSET ${offset}` : this.sql``;
    // Select and order the page from brain.people first, then join data sources
    // for that page only. This keeps the json_agg bounded to the page instead of
    // aggregating every matching person on each fetch.
    return this.sql.SelectPeoplePage`
      /* @type data_sources Array<{ data_source_key: string; data_source_user_id: string }> */
      /* @notNull records_count */
      WITH page AS (
        SELECT
          p.id,
          p.name,
          p.email,
          p.is_external,
          (SELECT COUNT(*) FROM brain.records_people rp WHERE rp.person_id = p.id)::int AS records_count
        FROM brain.people p
        ${where}
        ${this.buildOrderBy(sortBy, sortOrder, 'page')}
        ${limitClause}
        ${offsetClause}
      )
      SELECT
        page.id,
        page.name,
        page.email,
        page.is_external,
        COALESCE(
          json_agg(
            json_build_object(
              'data_source_key', ds.nango_integration_id,
              'data_source_user_id', pds.data_source_user_id
            )
            ORDER BY ds.nango_integration_id, pds.data_source_user_id
          ) FILTER (WHERE pds.id IS NOT NULL),
          '[]'
        ) AS data_sources,
        page.records_count
      FROM page
      LEFT JOIN brain.people_data_sources pds ON pds.person_id = page.id
      LEFT JOIN brain.data_sources ds ON ds.id = pds.data_source_id
      GROUP BY page.id, page.name, page.email, page.is_external, page.records_count
      ${this.buildOrderBy(sortBy, sortOrder, 'result')}
    `;
  }

  private buildOrderBy(
    sortBy: PersonSortField | undefined,
    sortOrder: PersonSortOrder | undefined,
    scope: 'page' | 'result',
  ) {
    const field = sortBy ?? DEFAULT_PERSON_SORT_FIELD;
    const direction =
      (sortOrder ?? DEFAULT_PERSON_SORT_ORDER) === 'desc' ? this.sql`DESC` : this.sql`ASC`;
    const name = scope === 'page' ? this.sql`p.name` : this.sql`page.name`;
    const id = scope === 'page' ? this.sql`p.id` : this.sql`page.id`;
    const recordsCount = scope === 'page' ? this.sql`records_count` : this.sql`page.records_count`;

    if (field === 'records_count') {
      return this.sql`ORDER BY ${recordsCount} ${direction}, ${name} ASC NULLS LAST, ${id} ASC`;
    }

    return this.sql`ORDER BY ${name} ${direction} NULLS LAST, ${id} ASC`;
  }
}
