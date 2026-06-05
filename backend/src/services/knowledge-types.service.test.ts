import { describe, expect, it } from 'bun:test';
import { ConflictError, NotFoundError } from '#lib/errors.ts';
import {
  type KnowledgeTypeRow,
  KnowledgeTypesRepositoryContract,
} from '#repositories/knowledge-types.repository.ts';
import { KnowledgeTypesService } from '#services/knowledge-types.service.ts';

const TYPE: KnowledgeTypeRow = {
  id: '019e8882-07f1-771c-993e-f6825a9224bb',
  name: 'meeting-note',
};

class MockKnowledgeTypesRepository extends KnowledgeTypesRepositoryContract {
  constructor(
    private readonly behavior: {
      created?: KnowledgeTypeRow | null;
      types?: KnowledgeTypeRow[];
      taken?: boolean;
      updated?: KnowledgeTypeRow | null;
      referenced?: boolean;
      removed?: KnowledgeTypeRow['id'] | null;
    } = {},
  ) {
    super();
  }

  create(): Promise<KnowledgeTypeRow | null> {
    return Promise.resolve(this.behavior.created ?? null);
  }
  list(): Promise<KnowledgeTypeRow[]> {
    return Promise.resolve(this.behavior.types ?? []);
  }
  findById(): Promise<KnowledgeTypeRow | null> {
    return Promise.resolve(null);
  }
  nameTaken(): Promise<boolean> {
    return Promise.resolve(this.behavior.taken ?? false);
  }
  update(): Promise<KnowledgeTypeRow | null> {
    return Promise.resolve(this.behavior.updated ?? null);
  }
  isReferenced(): Promise<boolean> {
    return Promise.resolve(this.behavior.referenced ?? false);
  }
  remove(): Promise<KnowledgeTypeRow['id'] | null> {
    return Promise.resolve(this.behavior.removed ?? null);
  }
}

describe('KnowledgeTypesService', () => {
  it('returns the created type', async () => {
    const service = new KnowledgeTypesService(new MockKnowledgeTypesRepository({ created: TYPE }));
    expect(await service.create('meeting-note')).toEqual(TYPE);
  });

  it('rejects a duplicate name on create', async () => {
    const service = new KnowledgeTypesService(new MockKnowledgeTypesRepository({ created: null }));
    await expect(service.create('meeting-note')).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects a rename onto an existing name', async () => {
    const service = new KnowledgeTypesService(new MockKnowledgeTypesRepository({ taken: true }));
    await expect(service.update(TYPE.id, 'taken')).rejects.toBeInstanceOf(ConflictError);
  });

  it('reports a missing type on update', async () => {
    const service = new KnowledgeTypesService(
      new MockKnowledgeTypesRepository({ taken: false, updated: null }),
    );
    await expect(service.update(TYPE.id, 'whatever')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to delete a referenced type', async () => {
    const service = new KnowledgeTypesService(
      new MockKnowledgeTypesRepository({ referenced: true }),
    );
    await expect(service.remove(TYPE.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it('reports a missing type on delete', async () => {
    const service = new KnowledgeTypesService(
      new MockKnowledgeTypesRepository({ referenced: false, removed: null }),
    );
    await expect(service.remove(TYPE.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the deleted id', async () => {
    const service = new KnowledgeTypesService(
      new MockKnowledgeTypesRepository({ removed: TYPE.id }),
    );
    expect(await service.remove(TYPE.id)).toBe(TYPE.id);
  });
});
