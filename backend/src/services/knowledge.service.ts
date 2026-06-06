import { BadRequestError, NotFoundError } from '#lib/errors.ts';
import {
  knowledgePagePath,
  renderKnowledgeHtmlPage,
  sanitizeKnowledgeHtml,
} from '#lib/knowledge-html.ts';
import {
  DEFAULT_KNOWLEDGE_RESULT_VIEW,
  type KnowledgeRepositoryContract,
  type KnowledgeResultView,
  type KnowledgeRow,
  type KnowledgeSearchParams,
} from '#repositories/knowledge.repository.ts';
import { Service } from '#services/service.ts';

export type CreateKnowledge = {
  title: string;
  body: string;
  knowledge_type_id: string;
  person_ids: string[];
  record_ids: string[];
};

export type KnowledgeType = {
  id: string;
  name: string;
};

export type Participant = {
  id: string;
  name: string | null;
  email: string | null;
  is_external: boolean;
  handle: string | null;
};

export type KnowledgeItem = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  html_url: string;
  knowledge_type: KnowledgeType;
  participants: Participant[];
  source_record_ids: string[];
};

type SearchHit = KnowledgeItem & {
  score: number | null;
  snippet: string | null;
};

export type KnowledgePreviewItem = Pick<KnowledgeItem, 'id' | 'title'>;

export type KnowledgeSearchRequest = KnowledgeSearchParams & {
  view?: KnowledgeResultView;
};

type SearchResult = SearchHit | KnowledgePreviewItem;

export class KnowledgeService extends Service {
  private readonly knowledgeRepo: KnowledgeRepositoryContract;

  constructor(knowledgeRepo: KnowledgeRepositoryContract) {
    super();
    this.knowledgeRepo = knowledgeRepo;
  }

  async search(
    params: KnowledgeSearchRequest,
  ): Promise<{ total: number | null; limit: number; offset: number; results: SearchResult[] }> {
    if (params.sortBy === 'relevance' && !params.query) {
      throw new BadRequestError('sort_by=relevance requires q');
    }

    const view = params.view ?? DEFAULT_KNOWLEDGE_RESULT_VIEW;

    if (view === 'full') {
      const { total, results } = await this.knowledgeRepo.searchFull(params);
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

    const { total, results } = await this.knowledgeRepo.searchPreview(params);

    return {
      total,
      limit: params.limit,
      offset: params.offset,
      results: results.map((row) => ({ id: row.id, title: row.title })),
    };
  }

  async getKnowledge(id: string): Promise<KnowledgeItem> {
    const row = await this.knowledgeRepo.getById(id);
    if (!row) {
      throw new NotFoundError(`Knowledge not found: ${id}`);
    }
    return this.toItem(row);
  }

  async getKnowledgeHtmlPage(id: string): Promise<string> {
    return renderKnowledgeHtmlPage(await this.getKnowledge(id));
  }

  async create(input: CreateKnowledge): Promise<KnowledgeItem> {
    const body = sanitizeKnowledgeHtml(input.body);
    if (body.trim().length === 0) {
      throw new BadRequestError('body must contain safe HTML content');
    }

    const result = await this.knowledgeRepo.create({
      title: input.title,
      body,
      knowledge_type_id: input.knowledge_type_id,
      personIds: [...new Set(input.person_ids)],
      recordIds: [...new Set(input.record_ids)],
    });

    if (!result.ok) {
      const problems: string[] = [];
      if (result.missingType) {
        problems.push(`unknown knowledge_type_id: ${input.knowledge_type_id}`);
      }
      if (result.missingPersonIds.length > 0) {
        problems.push(`unknown person_ids: ${result.missingPersonIds.join(', ')}`);
      }
      if (result.missingRecordIds.length > 0) {
        problems.push(`unknown record_ids: ${result.missingRecordIds.join(', ')}`);
      }
      throw new BadRequestError(problems.join('; '));
    }

    this.logger.info(`created knowledge ${result.id}`);
    return this.getKnowledge(result.id);
  }

  private toItem(row: KnowledgeRow): KnowledgeItem {
    return {
      id: row.id,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      title: row.title,
      body: row.body,
      html_url: knowledgePagePath(row.id),
      knowledge_type: { id: row.knowledge_type_id, name: row.knowledge_type_name },
      participants: row.participants,
      source_record_ids: row.source_record_ids,
    };
  }
}
