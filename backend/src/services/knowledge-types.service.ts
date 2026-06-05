import { ConflictError, NotFoundError } from '#lib/errors.ts';
import type {
  KnowledgeTypeRow,
  KnowledgeTypesRepositoryContract,
} from '#repositories/knowledge-types.repository.ts';
import { Service } from '#services/service.ts';

export class KnowledgeTypesService extends Service {
  private readonly knowledgeTypesRepo: KnowledgeTypesRepositoryContract;

  constructor(knowledgeTypesRepo: KnowledgeTypesRepositoryContract) {
    super();
    this.knowledgeTypesRepo = knowledgeTypesRepo;
  }

  async create(name: string): Promise<KnowledgeTypeRow> {
    const created = await this.knowledgeTypesRepo.create(name);
    if (!created) {
      throw new ConflictError(`Knowledge type already exists: ${name}`);
    }
    this.logger.info(`created knowledge type ${created.id}`);
    return created;
  }

  list(): Promise<KnowledgeTypeRow[]> {
    return this.knowledgeTypesRepo.list();
  }

  async update(id: string, name: string): Promise<KnowledgeTypeRow> {
    if (await this.knowledgeTypesRepo.nameTaken(name, id)) {
      throw new ConflictError(`Knowledge type already exists: ${name}`);
    }
    const updated = await this.knowledgeTypesRepo.update(id, name);
    if (!updated) {
      throw new NotFoundError(`Knowledge type not found: ${id}`);
    }
    this.logger.info(`updated knowledge type ${id}`);
    return updated;
  }

  async remove(id: string): Promise<KnowledgeTypeRow['id']> {
    if (await this.knowledgeTypesRepo.isReferenced(id)) {
      throw new ConflictError(`Knowledge type is still referenced by knowledge: ${id}`);
    }
    const removed = await this.knowledgeTypesRepo.remove(id);
    if (!removed) {
      throw new NotFoundError(`Knowledge type not found: ${id}`);
    }
    this.logger.info(`deleted knowledge type ${id}`);
    return removed;
  }
}
