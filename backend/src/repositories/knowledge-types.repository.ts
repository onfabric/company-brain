import type { QueryResults } from '@ilbertt/bun-sqlgen';
import { Repository } from '#repositories/repository.ts';

export type KnowledgeTypeRow = QueryResults['ListKnowledgeTypes'];

export abstract class KnowledgeTypesRepositoryContract {
  abstract create(name: string): Promise<KnowledgeTypeRow | null>;
  abstract list(): Promise<KnowledgeTypeRow[]>;
  abstract findById(id: string): Promise<KnowledgeTypeRow | null>;
  abstract nameTaken(name: string, excludeId: string): Promise<boolean>;
  abstract update(id: string, name: string): Promise<KnowledgeTypeRow | null>;
  abstract isReferenced(id: string): Promise<boolean>;
  abstract remove(id: string): Promise<string | null>;
}

export class KnowledgeTypesRepository
  extends Repository
  implements KnowledgeTypesRepositoryContract
{
  async create(name: string): Promise<KnowledgeTypeRow | null> {
    const [row] = await this.sql.CreateKnowledgeType`
      INSERT INTO brain.knowledge_types (name)
      VALUES (${name})
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    `;
    return row ?? null;
  }

  list(): Promise<KnowledgeTypeRow[]> {
    return this.sql.ListKnowledgeTypes`
      SELECT id, name FROM brain.knowledge_types ORDER BY name ASC
    `;
  }

  async findById(id: string): Promise<KnowledgeTypeRow | null> {
    const [row] = await this.sql.FindKnowledgeTypeById`
      SELECT id, name FROM brain.knowledge_types WHERE id = ${id}
    `;
    return row ?? null;
  }

  async nameTaken(name: string, excludeId: string): Promise<boolean> {
    const [row] = await this.sql.KnowledgeTypeNameTaken`
      SELECT EXISTS (
        SELECT 1 FROM brain.knowledge_types WHERE name = ${name} AND id <> ${excludeId}
      ) AS taken
    `;
    return row?.taken ?? false;
  }

  async update(id: string, name: string): Promise<KnowledgeTypeRow | null> {
    const [row] = await this.sql.UpdateKnowledgeType`
      UPDATE brain.knowledge_types SET name = ${name} WHERE id = ${id}
      RETURNING id, name
    `;
    return row ?? null;
  }

  async isReferenced(id: string): Promise<boolean> {
    const [row] = await this.sql.KnowledgeTypeIsReferenced`
      SELECT EXISTS (
        SELECT 1 FROM brain.knowledge WHERE knowledge_type_id = ${id}
      ) AS referenced
    `;
    return row?.referenced ?? false;
  }

  async remove(id: string): Promise<string | null> {
    const [row] = await this.sql.RemoveKnowledgeType`
      DELETE FROM brain.knowledge_types WHERE id = ${id} RETURNING id
    `;
    return row?.id ?? null;
  }
}
