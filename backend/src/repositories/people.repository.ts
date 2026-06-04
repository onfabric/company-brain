import type { DataSources, People, PeopleDataSources } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type PersonDataSource = {
  data_source_key: DataSources['nango_integration_id'];
  data_source_user_id: PeopleDataSources['data_source_user_id'];
};

export type PersonRow = Pick<People, 'id' | 'name' | 'email' | 'is_external'> & {
  data_sources: PersonDataSource[];
  records_count: number;
};

export type PersonIdentity = Pick<People, 'id' | 'name' | 'email'>;

export type PersonUpdate = Partial<Pick<People, 'name' | 'email' | 'is_external'>>;

export const PERSON_SORT_FIELDS = ['name', 'records_count'] as const;
export const PERSON_SORT_ORDERS = ['asc', 'desc'] as const;
export type PersonSortField = (typeof PERSON_SORT_FIELDS)[number];
export type PersonSortOrder = (typeof PERSON_SORT_ORDERS)[number];

const DEFAULT_PERSON_SORT_FIELD = 'name' satisfies PersonSortField;
const DEFAULT_PERSON_SORT_ORDER = 'asc' satisfies PersonSortOrder;

export type PersonFilters = {
  isExternal?: People['is_external'];
  sortBy?: PersonSortField;
  sortOrder?: PersonSortOrder;
};

export type MergeCounts = {
  moved_data_sources: number;
  moved_records: number;
};

export abstract class PeopleRepositoryContract {
  abstract listPeople(filters?: PersonFilters): Promise<PersonRow[]>;
  abstract getPerson(id: People['id']): Promise<PersonRow | null>;
  abstract findByIds(ids: People['id'][]): Promise<PersonIdentity[]>;
  abstract updatePerson(id: People['id'], updates: PersonUpdate): Promise<PersonRow | null>;
  abstract merge(fromId: People['id'], intoId: People['id']): Promise<MergeCounts>;
}

export class PeopleRepository extends Repository implements PeopleRepositoryContract {
  listPeople(filters: PersonFilters = {}): Promise<PersonRow[]> {
    return this.selectPeople({
      isExternal: filters.isExternal,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
  }

  async getPerson(id: People['id']): Promise<PersonRow | null> {
    const [person] = await this.selectPeople({ id });
    return person ?? null;
  }

  findByIds(ids: People['id'][]): Promise<PersonIdentity[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.sql<PersonIdentity[]>`
      SELECT id, name, email
      FROM brain.people
      WHERE id IN ${this.sql(ids)}
    `;
  }

  async updatePerson(id: People['id'], updates: PersonUpdate): Promise<PersonRow | null> {
    const [updated] = await this.sql<Pick<People, 'id'>[]>`
      UPDATE brain.people
      SET ${this.sql(updates)}
      WHERE id = ${id}
      RETURNING id
    `;
    return updated ? this.getPerson(updated.id) : null;
  }

  merge(fromId: People['id'], intoId: People['id']): Promise<MergeCounts> {
    return this.sql.begin(async (tx) => {
      const movedDataSources = await tx<Pick<PeopleDataSources, 'id'>[]>`
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

      const movedRecords = await tx<{ record_id: string }[]>`
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

  private selectPeople({
    id,
    isExternal,
    sortBy,
    sortOrder,
  }: {
    id?: People['id'];
    isExternal?: People['is_external'];
    sortBy?: PersonSortField;
    sortOrder?: PersonSortOrder;
  } = {}): Promise<PersonRow[]> {
    const conditions = [];
    if (id !== undefined) {
      conditions.push(this.sql`p.id = ${id}`);
    }
    if (isExternal !== undefined) {
      conditions.push(this.sql`p.is_external = ${isExternal}`);
    }
    const where = conditions.length
      ? this.sql`WHERE ${conditions.reduce((acc, cond) => this.sql`${acc} AND ${cond}`)}`
      : this.sql``;
    const orderBy = this.buildOrderBy(sortBy, sortOrder);
    return this.sql<PersonRow[]>`
      SELECT
        p.id,
        p.name,
        p.email,
        p.is_external,
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
        (SELECT COUNT(*) FROM brain.records_people rp WHERE rp.person_id = p.id)::int AS records_count
      FROM brain.people p
      LEFT JOIN brain.people_data_sources pds ON pds.person_id = p.id
      LEFT JOIN brain.data_sources ds ON ds.id = pds.data_source_id
      ${where}
      GROUP BY p.id, p.name, p.email, p.is_external
      ${orderBy}
    `;
  }

  private buildOrderBy(sortBy?: PersonSortField, sortOrder?: PersonSortOrder) {
    const field = sortBy ?? DEFAULT_PERSON_SORT_FIELD;
    const direction =
      (sortOrder ?? DEFAULT_PERSON_SORT_ORDER) === 'desc' ? this.sql`DESC` : this.sql`ASC`;

    if (field === 'records_count') {
      return this.sql`ORDER BY records_count ${direction}, p.name ASC NULLS LAST, p.id ASC`;
    }

    return this.sql`ORDER BY p.name ${direction} NULLS LAST, p.id ASC`;
  }
}
