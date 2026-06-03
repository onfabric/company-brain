import type { PeopleRepositoryContract } from '#repositories/people.repository.ts';
import { Service } from '#services/service.ts';

type PersonDataSource = {
  data_source_key: string;
  data_source_user_id: string;
};

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  data_sources: PersonDataSource[];
};

export class PeopleService extends Service {
  private readonly peopleRepo: PeopleRepositoryContract;

  constructor(peopleRepo: PeopleRepositoryContract) {
    super();
    this.peopleRepo = peopleRepo;
  }

  async listPeople(): Promise<{ people: Person[] }> {
    const people = await this.peopleRepo.listPeople();
    return { people };
  }
}
