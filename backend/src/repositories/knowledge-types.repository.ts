import type { KnowledgeTypes } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type KnowledgeTypeRow = KnowledgeTypes;

export abstract class KnowledgeTypesRepositoryContract {
  abstract create(name: KnowledgeTypes['name']): Promise<KnowledgeTypeRow | null>;
  abstract list(): Promise<KnowledgeTypeRow[]>;
  abstract findById(id: KnowledgeTypes['id']): Promise<KnowledgeTypeRow | null>;
  abstract nameTaken(
    name: KnowledgeTypes['name'],
    excludeId: KnowledgeTypes['id'],
  ): Promise<boolean>;
  abstract update(
    id: KnowledgeTypes['id'],
    name: KnowledgeTypes['name'],
  ): Promise<KnowledgeTypeRow | null>;
  abstract isReferenced(id: KnowledgeTypes['id']): Promise<boolean>;
  abstract remove(id: KnowledgeTypes['id']): Promise<KnowledgeTypes['id'] | null>;
}

export class KnowledgeTypesRepository
  extends Repository
  implements KnowledgeTypesRepositoryContract
{
  async create(name: KnowledgeTypes['name']): Promise<KnowledgeTypeRow | null> {
    const [row] = await this.sql<KnowledgeTypeRow[]>`
      INSERT INTO brain.knowledge_types (name)
      VALUES (${name})
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    `;
    return row ?? null;
  }

  list(): Promise<KnowledgeTypeRow[]> {
    return this.sql<KnowledgeTypeRow[]>`
      SELECT id, name FROM brain.knowledge_types ORDER BY name ASC
    `;
  }

  async findById(id: KnowledgeTypes['id']): Promise<KnowledgeTypeRow | null> {
    const [row] = await this.sql<KnowledgeTypeRow[]>`
      SELECT id, name FROM brain.knowledge_types WHERE id = ${id}
    `;
    return row ?? null;
  }

  async nameTaken(name: KnowledgeTypes['name'], excludeId: KnowledgeTypes['id']): Promise<boolean> {
    const [row] = await this.sql<{ taken: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM brain.knowledge_types WHERE name = ${name} AND id <> ${excludeId}
      ) AS taken
    `;
    return row?.taken ?? false;
  }

  async update(
    id: KnowledgeTypes['id'],
    name: KnowledgeTypes['name'],
  ): Promise<KnowledgeTypeRow | null> {
    const [row] = await this.sql<KnowledgeTypeRow[]>`
      UPDATE brain.knowledge_types SET name = ${name} WHERE id = ${id}
      RETURNING id, name
    `;
    return row ?? null;
  }

  async isReferenced(id: KnowledgeTypes['id']): Promise<boolean> {
    const [row] = await this.sql<{ referenced: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM brain.knowledge WHERE knowledge_type_id = ${id}
      ) AS referenced
    `;
    return row?.referenced ?? false;
  }

  async remove(id: KnowledgeTypes['id']): Promise<KnowledgeTypes['id'] | null> {
    const [row] = await this.sql<Pick<KnowledgeTypes, 'id'>[]>`
      DELETE FROM brain.knowledge_types WHERE id = ${id} RETURNING id
    `;
    return row?.id ?? null;
  }
}
