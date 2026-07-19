import { apiKeyDisplayPrefix, generateApiKey, hashApiKey } from '#lib/auth/api-key.ts';
import type { AuthUserId } from '#lib/auth/better-auth.ts';
import { ForbiddenError, NotFoundError } from '#lib/errors.ts';
import type { ApiKeyRow, ApiKeysRepositoryContract } from '#repositories/api-keys.repository.ts';
import { Service } from '#services/service.ts';

export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  updated_at: string;
  created_by: AuthUserId;
};

export type CreatedApiKey = ApiKey & { key: string };

function toApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    key_prefix: row.key_prefix,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    created_by: row.created_by,
  };
}

export class ApiKeysService extends Service {
  private readonly apiKeysRepo: ApiKeysRepositoryContract;

  constructor(apiKeysRepo: ApiKeysRepositoryContract) {
    super();
    this.apiKeysRepo = apiKeysRepo;
  }

  async create(name: string, createdBy: AuthUserId): Promise<CreatedApiKey> {
    const key = generateApiKey();
    const created = await this.apiKeysRepo.create({
      name,
      keyHash: hashApiKey(key),
      keyPrefix: apiKeyDisplayPrefix(key),
      createdBy,
    });
    this.logger.info(`created api key ${created.id} by ${createdBy}`);
    return { ...toApiKey(created), key };
  }

  async list(): Promise<ApiKey[]> {
    const rows = await this.apiKeysRepo.list();
    return rows.map(toApiKey);
  }

  async update(id: string, name: string, userId: AuthUserId): Promise<ApiKey> {
    const createdBy = await this.apiKeysRepo.findCreatedBy(id);
    if (createdBy === null) {
      throw new NotFoundError(`API key not found: ${id}`);
    }
    if (createdBy !== userId) {
      throw new ForbiddenError('You can only modify API keys you created.');
    }
    const updated = await this.apiKeysRepo.update(id, name);
    if (!updated) {
      throw new NotFoundError(`API key not found: ${id}`);
    }
    this.logger.info(`updated api key ${id}`);
    return toApiKey(updated);
  }

  async remove(id: string, userId: AuthUserId): Promise<ApiKey['id']> {
    const createdBy = await this.apiKeysRepo.findCreatedBy(id);
    if (createdBy === null) {
      throw new NotFoundError(`API key not found: ${id}`);
    }
    if (createdBy !== userId) {
      throw new ForbiddenError('You can only delete API keys you created.');
    }
    const removed = await this.apiKeysRepo.remove(id);
    if (!removed) {
      throw new NotFoundError(`API key not found: ${id}`);
    }
    this.logger.info(`deleted api key ${id}`);
    return removed;
  }

  async verify(key: string | null): Promise<boolean> {
    if (!key) {
      return false;
    }
    try {
      return await this.apiKeysRepo.existsByHash(hashApiKey(key));
    } catch (error) {
      this.logger.error(`api key verification failed: ${error}`);
      return false;
    }
  }
}
