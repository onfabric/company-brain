import type { Queries } from '#db/queries.gen.d.ts';
import type { AuthUserId } from '#lib/auth/better-auth.ts';
import { Repository } from '#repositories/repository.ts';

export type ApiKeyRow = Queries['ListApiKeys'];

export type CreateApiKeyInput = {
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdBy: AuthUserId;
};

export abstract class ApiKeysRepositoryContract {
  abstract create(input: CreateApiKeyInput): Promise<ApiKeyRow>;
  abstract list(): Promise<ApiKeyRow[]>;
  abstract existsByHash(keyHash: string): Promise<boolean>;
  abstract findCreatedBy(id: string): Promise<AuthUserId | null>;
  abstract update(id: string, name: string): Promise<ApiKeyRow | null>;
  abstract remove(id: string): Promise<string | null>;
}

export class ApiKeysRepository extends Repository implements ApiKeysRepositoryContract {
  async create({ name, keyHash, keyPrefix, createdBy }: CreateApiKeyInput): Promise<ApiKeyRow> {
    const [row] = await this.sql.CreateApiKey`
      INSERT INTO brain.api_keys (name, key_hash, key_prefix, created_by)
      VALUES (${name}, ${keyHash}, ${keyPrefix}, ${createdBy})
      RETURNING id, name, key_prefix, created_at, updated_at, created_by
    `;
    if (!row) {
      throw new Error('Failed to insert API key');
    }
    return row;
  }

  list(): Promise<ApiKeyRow[]> {
    return this.sql.ListApiKeys`
      SELECT id, name, key_prefix, created_at, updated_at, created_by
      FROM brain.api_keys ORDER BY id DESC
    `;
  }

  async existsByHash(keyHash: string): Promise<boolean> {
    const [row] = await this.sql.ApiKeyExists`
      SELECT EXISTS (
        SELECT 1 FROM brain.api_keys WHERE key_hash = ${keyHash}
      ) AS exists
    `;
    return row?.exists ?? false;
  }

  async findCreatedBy(id: string): Promise<AuthUserId | null> {
    const [row] = await this.sql.FindApiKeyCreatedBy`
      SELECT created_by FROM brain.api_keys WHERE id = ${id}
    `;
    return row?.created_by ?? null;
  }

  async update(id: string, name: string): Promise<ApiKeyRow | null> {
    const [row] = await this.sql.UpdateApiKey`
      UPDATE brain.api_keys SET name = ${name} WHERE id = ${id}
      RETURNING id, name, key_prefix, created_at, updated_at, created_by
    `;
    return row ?? null;
  }

  async remove(id: string): Promise<string | null> {
    const [row] = await this.sql.RemoveApiKey`
      DELETE FROM brain.api_keys WHERE id = ${id} RETURNING id
    `;
    return row?.id ?? null;
  }
}
