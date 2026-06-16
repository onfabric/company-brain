import type { ApiKeys } from '#db/tables.ts';
import { Repository } from '#repositories/repository.ts';

export type ApiKeyRow = Pick<ApiKeys, 'id' | 'name' | 'key_prefix' | 'created_at' | 'updated_at'>;

export type CreateApiKeyInput = {
  name: ApiKeys['name'];
  keyHash: ApiKeys['key_hash'];
  keyPrefix: ApiKeys['key_prefix'];
  createdBy: ApiKeys['created_by'];
};

export abstract class ApiKeysRepositoryContract {
  abstract create(input: CreateApiKeyInput): Promise<ApiKeyRow>;
  abstract list(): Promise<ApiKeyRow[]>;
  abstract existsByHash(keyHash: ApiKeys['key_hash']): Promise<boolean>;
  abstract findCreatedBy(id: ApiKeys['id']): Promise<ApiKeys['created_by'] | null>;
  abstract update(id: ApiKeys['id'], name: ApiKeys['name']): Promise<ApiKeyRow | null>;
  abstract remove(id: ApiKeys['id']): Promise<ApiKeys['id'] | null>;
}

export class ApiKeysRepository extends Repository implements ApiKeysRepositoryContract {
  async create({ name, keyHash, keyPrefix, createdBy }: CreateApiKeyInput): Promise<ApiKeyRow> {
    const [row] = await this.sql<ApiKeyRow[]>`
      INSERT INTO brain.api_keys (name, key_hash, key_prefix, created_by)
      VALUES (${name}, ${keyHash}, ${keyPrefix}, ${createdBy})
      RETURNING id, name, key_prefix, created_at, updated_at
    `;
    if (!row) {
      throw new Error('Failed to insert API key');
    }
    return row;
  }

  list(): Promise<ApiKeyRow[]> {
    return this.sql<ApiKeyRow[]>`
      SELECT id, name, key_prefix, created_at, updated_at
      FROM brain.api_keys ORDER BY id DESC
    `;
  }

  async existsByHash(keyHash: ApiKeys['key_hash']): Promise<boolean> {
    const [row] = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM brain.api_keys WHERE key_hash = ${keyHash}
      ) AS exists
    `;
    return row?.exists ?? false;
  }

  async findCreatedBy(id: ApiKeys['id']): Promise<ApiKeys['created_by'] | null> {
    const [row] = await this.sql<Pick<ApiKeys, 'created_by'>[]>`
      SELECT created_by FROM brain.api_keys WHERE id = ${id}
    `;
    return row?.created_by ?? null;
  }

  async update(id: ApiKeys['id'], name: ApiKeys['name']): Promise<ApiKeyRow | null> {
    const [row] = await this.sql<ApiKeyRow[]>`
      UPDATE brain.api_keys SET name = ${name} WHERE id = ${id}
      RETURNING id, name, key_prefix, created_at, updated_at
    `;
    return row ?? null;
  }

  async remove(id: ApiKeys['id']): Promise<ApiKeys['id'] | null> {
    const [row] = await this.sql<Pick<ApiKeys, 'id'>[]>`
      DELETE FROM brain.api_keys WHERE id = ${id} RETURNING id
    `;
    return row?.id ?? null;
  }
}
