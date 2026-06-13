import { describe, expect, it } from 'bun:test';
import {
  type MergeCounts,
  PeopleRepositoryContract,
  type PersonFilters,
  type PersonIdentity,
  type PersonRow,
  type PersonUpdate,
} from '#repositories/people.repository.ts';
import { PeopleService } from '#services/people.service.ts';

const FROM_ID = '019e8882-07f1-771c-993e-f6825a9224bb';
const INTO_ID = '019e8882-07f1-77a0-b4cf-5798eafb4664';

class MockPeopleRepository extends PeopleRepositoryContract {
  listCalls: PersonFilters[] = [];
  mergeCalls: Array<{ fromId: string; intoId: string }> = [];
  updateCalls: Array<{ id: string; updates: PersonUpdate }> = [];

  constructor(
    private readonly identities: PersonIdentity[],
    private readonly person: PersonRow | null = null,
    private readonly counts: MergeCounts = { moved_data_sources: 0, moved_records: 0 },
  ) {
    super();
  }

  listPeople(filters: PersonFilters = {}): Promise<PersonRow[]> {
    this.listCalls.push(filters);
    return Promise.resolve([]);
  }

  countPeople(): Promise<number> {
    return Promise.resolve(0);
  }

  getPerson(): Promise<PersonRow | null> {
    return Promise.resolve(this.person);
  }

  findByIds(ids: string[]): Promise<PersonIdentity[]> {
    return Promise.resolve(this.identities.filter((identity) => ids.includes(identity.id)));
  }

  findByNameOrEmail(values: string[]): Promise<PersonIdentity[]> {
    return Promise.resolve(
      this.identities.filter(
        (identity) =>
          (identity.name !== null && values.includes(identity.name)) ||
          (identity.email !== null && values.includes(identity.email)),
      ),
    );
  }

  updatePerson(id: string, updates: PersonUpdate): Promise<PersonRow | null> {
    this.updateCalls.push({ id, updates });
    return Promise.resolve(this.person);
  }

  merge(fromId: string, intoId: string): Promise<MergeCounts> {
    this.mergeCalls.push({ fromId, intoId });
    return Promise.resolve(this.counts);
  }
}

describe('PeopleService.mergePeople', () => {
  it('reassigns sources/records and returns the merged person with counts', async () => {
    const mergedPerson: PersonRow = {
      id: INTO_ID,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      is_external: false,
      data_sources: [{ data_source_key: 'slack', data_source_user_id: 'U07ABC' }],
      records_count: 3,
    };
    const repo = new MockPeopleRepository(
      [
        { id: FROM_ID, name: null, email: null },
        { id: INTO_ID, name: 'Ada Lovelace', email: 'ada@example.com' },
      ],
      mergedPerson,
      { moved_data_sources: 1, moved_records: 3 },
    );
    const service = new PeopleService(repo);

    const result = await service.mergePeople(FROM_ID, INTO_ID);

    expect(repo.mergeCalls).toEqual([{ fromId: FROM_ID, intoId: INTO_ID }]);
    expect(result).toEqual({
      person: mergedPerson,
      moved_data_sources: 1,
      moved_records: 3,
    });
  });

  it('rejects merging a person into itself', async () => {
    const repo = new MockPeopleRepository([]);
    const service = new PeopleService(repo);

    await expect(service.mergePeople(FROM_ID, FROM_ID)).rejects.toThrow(
      'merge_from_id and merge_into_id must be different',
    );
    expect(repo.mergeCalls).toEqual([]);
  });

  it('404s when either person is missing', async () => {
    const repo = new MockPeopleRepository([{ id: INTO_ID, name: null, email: null }]);
    const service = new PeopleService(repo);

    await expect(service.mergePeople(FROM_ID, INTO_ID)).rejects.toThrow(
      `Person not found: ${FROM_ID}`,
    );
    expect(repo.mergeCalls).toEqual([]);
  });

  it('refuses to merge when merge_from has a name or email', async () => {
    const repo = new MockPeopleRepository([
      { id: FROM_ID, name: 'Grace Hopper', email: null },
      { id: INTO_ID, name: null, email: null },
    ]);
    const service = new PeopleService(repo);

    await expect(service.mergePeople(FROM_ID, INTO_ID)).rejects.toThrow(
      'merge_from person must have null name and email',
    );
    expect(repo.mergeCalls).toEqual([]);
  });
});

describe('PeopleService.listPeople', () => {
  it('forwards filters and sort options to the repository', async () => {
    const repo = new MockPeopleRepository([]);
    const service = new PeopleService(repo);

    await service.listPeople({
      isExternal: true,
      hasReadableIdentity: true,
      sortBy: 'records_count',
      sortOrder: 'desc',
    });

    expect(repo.listCalls).toEqual([
      {
        isExternal: true,
        hasReadableIdentity: true,
        sortBy: 'records_count',
        sortOrder: 'desc',
      },
    ]);
  });
});

describe('PeopleService.updatePerson', () => {
  it('persists the provided fields and returns the updated person', async () => {
    const updatedPerson: PersonRow = {
      id: INTO_ID,
      name: 'Ada Lovelace',
      email: null,
      is_external: true,
      data_sources: [],
      records_count: 0,
    };
    const repo = new MockPeopleRepository([], updatedPerson);
    const service = new PeopleService(repo);

    const result = await service.updatePerson(INTO_ID, {
      name: 'Ada Lovelace',
      email: null,
      is_external: true,
    });

    expect(repo.updateCalls).toEqual([
      { id: INTO_ID, updates: { name: 'Ada Lovelace', email: null, is_external: true } },
    ]);
    expect(result).toEqual(updatedPerson);
  });

  it('404s when the person does not exist', async () => {
    const repo = new MockPeopleRepository([], null);
    const service = new PeopleService(repo);

    await expect(service.updatePerson(INTO_ID, { name: 'Ada' })).rejects.toThrow(
      `Person not found: ${INTO_ID}`,
    );
  });
});
