import { describe, expect, it } from 'bun:test';
import { apiKeyDisplayPrefix, hashApiKey } from '#lib/auth/api-key.ts';
import { NotFoundError } from '#lib/errors.ts';
import {
  type ApiKeyRow,
  ApiKeysRepositoryContract,
  type CreateApiKeyInput,
} from '#repositories/api-keys.repository.ts';
import { ApiKeysService } from '#services/api-keys.service.ts';

const ROW: ApiKeyRow = {
  id: '019e8882-07f1-771c-993e-f6825a9224bb',
  name: 'ci',
  key_prefix: '019e8882',
  created_at: new Date('2026-06-16T00:00:00.000Z'),
  updated_at: new Date('2026-06-16T00:00:00.000Z'),
};

class MockApiKeysRepository extends ApiKeysRepositoryContract {
  lastCreate: CreateApiKeyInput | null = null;

  constructor(
    private readonly behavior: {
      created?: ApiKeyRow;
      keys?: ApiKeyRow[];
      exists?: boolean;
      updated?: ApiKeyRow | null;
      removed?: ApiKeyRow['id'] | null;
    } = {},
  ) {
    super();
  }

  create(input: CreateApiKeyInput): Promise<ApiKeyRow> {
    this.lastCreate = input;
    return Promise.resolve(this.behavior.created ?? ROW);
  }
  list(): Promise<ApiKeyRow[]> {
    return Promise.resolve(this.behavior.keys ?? []);
  }
  existsByHash(): Promise<boolean> {
    return Promise.resolve(this.behavior.exists ?? false);
  }
  update(): Promise<ApiKeyRow | null> {
    return Promise.resolve(this.behavior.updated ?? null);
  }
  remove(): Promise<ApiKeyRow['id'] | null> {
    return Promise.resolve(this.behavior.removed ?? null);
  }
}

describe('ApiKeysService', () => {
  it('returns the full key once and stores only its hash and prefix', async () => {
    const repo = new MockApiKeysRepository({ created: ROW });
    const service = new ApiKeysService(repo);

    const created = await service.create('ci');

    expect(created.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(created.id).toBe(ROW.id);
    expect(created.created_at).toBe('2026-06-16T00:00:00.000Z');
    expect(repo.lastCreate?.name).toBe('ci');
    expect(repo.lastCreate?.keyHash).toBe(hashApiKey(created.key));
    expect(repo.lastCreate?.keyPrefix).toBe(apiKeyDisplayPrefix(created.key));
  });

  it('serializes timestamps to ISO strings on list', async () => {
    const service = new ApiKeysService(new MockApiKeysRepository({ keys: [ROW] }));
    expect(await service.list()).toEqual([
      {
        id: ROW.id,
        name: ROW.name,
        key_prefix: ROW.key_prefix,
        created_at: '2026-06-16T00:00:00.000Z',
        updated_at: '2026-06-16T00:00:00.000Z',
      },
    ]);
  });

  it('reports a missing key on update', async () => {
    const service = new ApiKeysService(new MockApiKeysRepository({ updated: null }));
    await expect(service.update(ROW.id, 'renamed')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('reports a missing key on delete', async () => {
    const service = new ApiKeysService(new MockApiKeysRepository({ removed: null }));
    await expect(service.remove(ROW.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the deleted id', async () => {
    const service = new ApiKeysService(new MockApiKeysRepository({ removed: ROW.id }));
    expect(await service.remove(ROW.id)).toBe(ROW.id);
  });

  it('rejects a missing key on verify without touching the repository', async () => {
    const service = new ApiKeysService(new MockApiKeysRepository({ exists: true }));
    expect(await service.verify(null)).toBe(false);
  });

  it('accepts a key whose hash exists', async () => {
    const service = new ApiKeysService(new MockApiKeysRepository({ exists: true }));
    expect(await service.verify('00000000-0000-4000-8000-000000000000')).toBe(true);
  });

  it('fails closed when the repository throws', async () => {
    class ThrowingRepo extends MockApiKeysRepository {
      override existsByHash(): Promise<boolean> {
        return Promise.reject(new Error('db down'));
      }
    }
    const service = new ApiKeysService(new ThrowingRepo());
    expect(await service.verify('00000000-0000-4000-8000-000000000000')).toBe(false);
  });
});
