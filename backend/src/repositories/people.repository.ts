import type { DataSources, People, PeopleDataSources } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type PersonDataSource = {
  data_source_key: DataSources['nango_integration_id'];
  data_source_user_id: PeopleDataSources['data_source_user_id'];
};

export type PersonRow = Pick<People, 'id' | 'name' | 'email'> & {
  data_sources: PersonDataSource[];
};

export abstract class PeopleRepositoryContract {
  abstract listPeople(): Promise<PersonRow[]>;
}

export class PeopleRepository extends Repository implements PeopleRepositoryContract {
  listPeople(): Promise<PersonRow[]> {
    return this.sql<PersonRow[]>`
      SELECT
        p.id,
        p.name,
        p.email,
        COALESCE(
          json_agg(
            json_build_object(
              'data_source_key', ds.nango_integration_id,
              'data_source_user_id', pds.data_source_user_id
            )
            ORDER BY ds.nango_integration_id, pds.data_source_user_id
          ) FILTER (WHERE pds.id IS NOT NULL),
          '[]'
        ) AS data_sources
      FROM brain.people p
      LEFT JOIN brain.people_data_sources pds ON pds.person_id = p.id
      LEFT JOIN brain.data_sources ds ON ds.id = pds.data_source_id
      GROUP BY p.id, p.name, p.email
      ORDER BY p.name NULLS LAST, p.id
    `;
  }
}
