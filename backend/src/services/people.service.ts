import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import type {
  PeopleRepositoryContract,
  PersonFilters,
  PersonUpdate,
} from '#repositories/people.repository.ts';
import { Service } from '#services/service.ts';

type PersonDataSource = {
  data_source_key: string;
  data_source_user_id: string;
};

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  is_external: boolean;
  data_sources: PersonDataSource[];
};

type MergeResult = {
  person: Person;
  moved_data_sources: number;
  moved_records: number;
};

export class PeopleService extends Service {
  private readonly peopleRepo: PeopleRepositoryContract;

  constructor(peopleRepo: PeopleRepositoryContract) {
    super();
    this.peopleRepo = peopleRepo;
  }

  async listPeople(filters: PersonFilters = {}): Promise<{ people: Person[] }> {
    const people = await this.peopleRepo.listPeople(filters);
    return { people };
  }

  async updatePerson(id: string, updates: PersonUpdate): Promise<Person> {
    const person = await this.peopleRepo.updatePerson(id, updates);
    if (!person) {
      throw new NotFoundError(`Person not found: ${id}`);
    }

    this.logger.info(`updated person ${id}`);

    return person;
  }

  async mergePeople(fromId: string, intoId: string): Promise<MergeResult> {
    if (fromId === intoId) {
      throw new BadRequestError('merge_from_id and merge_into_id must be different');
    }

    const identities = await this.peopleRepo.findByIds([fromId, intoId]);
    const from = identities.find((person) => person.id === fromId);
    const into = identities.find((person) => person.id === intoId);
    if (!from) {
      throw new NotFoundError(`Person not found: ${fromId}`);
    }
    if (!into) {
      throw new NotFoundError(`Person not found: ${intoId}`);
    }
    if (from.name !== null || from.email !== null) {
      throw new BadRequestError(
        'merge_from person must have null name and email; pass the ingestion-created duplicate as merge_from_id',
      );
    }

    const counts = await this.peopleRepo.merge(fromId, intoId);
    const person = await this.peopleRepo.getPerson(intoId);
    if (!person) {
      throw new NotFoundError(`Person not found: ${intoId}`);
    }

    this.logger.info(
      `merged person ${fromId} into ${intoId}: ${counts.moved_data_sources} data source(s), ${counts.moved_records} record link(s)`,
    );

    return { person, ...counts };
  }
}
