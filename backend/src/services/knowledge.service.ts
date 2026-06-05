import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import type {
  KnowledgeRepositoryContract,
  KnowledgeRow,
  KnowledgeSearchParams,
} from '#repositories/knowledge.repository.ts';
import { Service } from '#services/service.ts';

type KnowledgeType = {
  id: string;
  name: string;
};

type Participant = {
  id: string;
  name: string | null;
  email: string | null;
  is_external: boolean;
  handle: string | null;
};

type KnowledgeItem = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  knowledge_type: KnowledgeType;
  participants: Participant[];
  source_record_ids: string[];
};

type SearchHit = KnowledgeItem & {
  score: number | null;
  snippet: string | null;
};

export class KnowledgeService extends Service {
  private readonly knowledgeRepo: KnowledgeRepositoryContract;

  constructor(knowledgeRepo: KnowledgeRepositoryContract) {
    super();
    this.knowledgeRepo = knowledgeRepo;
  }

  async search(
    params: KnowledgeSearchParams,
  ): Promise<{ total: number | null; limit: number; offset: number; results: SearchHit[] }> {
    if (params.sortBy === 'relevance' && !params.query) {
      throw new BadRequestError('sort_by=relevance requires q');
    }

    const { total, results } = await this.knowledgeRepo.search(params);

    return {
      total,
      limit: params.limit,
      offset: params.offset,
      results: results.map((row) => ({
        ...this.toItem(row),
        score: row.score,
        snippet: row.snippet,
      })),
    };
  }

  async getKnowledge(id: string): Promise<KnowledgeItem> {
    const row = await this.knowledgeRepo.getById(id);
    if (!row) {
      throw new NotFoundError(`Knowledge not found: ${id}`);
    }
    return this.toItem(row);
  }

  private toItem(row: KnowledgeRow): KnowledgeItem {
    return {
      id: row.id,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      title: row.title,
      body: row.body,
      knowledge_type: { id: row.knowledge_type_id, name: row.knowledge_type_name },
      participants: row.participants,
      source_record_ids: row.source_record_ids,
    };
  }
}
