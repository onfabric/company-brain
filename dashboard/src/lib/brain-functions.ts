import { z } from 'zod';
import { redirectToSignIn } from '#/lib/auth.ts';
import {
  API_MAX_LIMIT,
  DEFAULT_LIMIT,
  EMPTY_COUNT,
  EMPTY_OFFSET,
  FIRST_PAGE,
  HTTP_UNAUTHORIZED,
  NEXT_DAY_OFFSET,
  type PEOPLE_SORT_FIELDS,
  type PEOPLE_SORT_ORDERS,
  RECORD_SORT_FIELDS,
  RECORD_SORT_ORDERS,
} from '#/lib/constants.ts';

const PersonSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  is_external: z.boolean(),
});

const ParticipantSchema = PersonSchema.extend({
  handle: z.string().nullable(),
});

const RecordHitSchema = z
  .object({
    id: z.uuid(),
    data_source_id: z.uuid(),
    data_source_key: z.string().optional(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
    body: z.string(),
    participants: z.array(ParticipantSchema).default([]),
    score: z.number().nullable(),
    snippet: z.string().nullable(),
  })
  .transform((record) => ({
    ...record,
    data_source_key: record.data_source_key ?? record.data_source_id,
  }));

const RecordsResponseSchema = z.object({
  total: z.number().int().nullable(),
  limit: z.number().int(),
  offset: z.number().int(),
  results: z.array(RecordHitSchema),
});

const SourceSchema = z.object({
  data_source_id: z.uuid(),
  data_source_key: z.string(),
  count: z.number().int(),
  oldest_created_at: z.iso.datetime(),
  newest_created_at: z.iso.datetime(),
  newest_updated_at: z.iso.datetime(),
});

const SourcesResponseSchema = z.object({
  sources: z.array(SourceSchema),
});

const PersonDataSourceSchema = z.object({
  data_source_key: z.string(),
  data_source_user_id: z.string(),
});

const PersonDetailsSchema = PersonSchema.extend({
  data_sources: z.array(PersonDataSourceSchema),
  records_count: z.number().int(),
});

const PeopleResponseSchema = z.object({
  total: z.number().int(),
  people: z.array(PersonDetailsSchema),
});

const KnowledgePreviewSchema = z.object({
  id: z.uuid(),
  title: z.string(),
});

const KnowledgePreviewResponseSchema = z.object({
  total: z.number().int().nullable(),
  limit: z.number().int(),
  offset: z.number().int(),
  results: z.array(KnowledgePreviewSchema),
});

const KnowledgeTypeSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

const KnowledgeTypesResponseSchema = z.object({
  knowledge_types: z.array(KnowledgeTypeSchema),
});

export class BrainApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export const RecordsQueryInputSchema = z.object({
  q: z.string().optional(),
  dataSourceId: z.uuid().optional(),
  personId: z.uuid().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  sortBy: z.enum(RECORD_SORT_FIELDS).optional(),
  sortOrder: z.enum(RECORD_SORT_ORDERS).optional(),
  offset: z.number().int().min(EMPTY_OFFSET).default(EMPTY_OFFSET),
  limit: z.number().int().min(FIRST_PAGE).max(API_MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PeopleSortField = (typeof PEOPLE_SORT_FIELDS)[number];
export type PeopleSortOrder = (typeof PEOPLE_SORT_ORDERS)[number];
export type RecordHit = z.infer<typeof RecordHitSchema>;
export type RecordsResponse = z.infer<typeof RecordsResponseSchema>;
export type RecordsQueryInput = z.infer<typeof RecordsQueryInputSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Person = z.infer<typeof PersonDetailsSchema>;
export type KnowledgePreview = z.infer<typeof KnowledgePreviewSchema>;
export type KnowledgePreviewResponse = z.infer<typeof KnowledgePreviewResponseSchema>;
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;
export type KnowledgeTypesResponse = z.infer<typeof KnowledgeTypesResponseSchema>;
export type PersonUpdateInput = Partial<Pick<Person, 'name' | 'email' | 'is_external'>>;
export type ListPeopleInput = {
  isExternal?: boolean;
  sortBy?: PeopleSortField;
  sortOrder?: PeopleSortOrder;
  query?: string;
  limit?: number;
  offset?: number;
};
export type ListKnowledgeInput = {
  q?: string;
  knowledgeTypeId?: string;
  limit?: number;
  offset?: number;
};

export async function listRecords(input: RecordsQueryInput) {
  const params = new URLSearchParams();
  const query = input.q?.trim();
  if (query) {
    params.set('q', query);
  }
  if (input.dataSourceId) {
    params.set('data_source_id', input.dataSourceId);
  }
  if (input.personId) {
    params.append('person_id', input.personId);
  }
  if (input.createdAfter) {
    params.set('created_after', startOfDayIso(input.createdAfter));
  }
  if (input.createdBefore) {
    params.set('created_before', exclusiveEndOfDayIso(input.createdBefore));
  }
  if (input.sortBy) {
    params.set('sort_by', input.sortBy);
  }
  if (input.sortOrder) {
    params.set('sort_order', input.sortOrder);
  }

  params.set('limit', String(input.limit));
  params.set('offset', String(input.offset));

  return await fetchBrain(`/records?${params.toString()}`, RecordsResponseSchema);
}

export async function listDataSources() {
  return await fetchBrain('/data-sources', SourcesResponseSchema);
}

export async function listPeople(input: ListPeopleInput = {}) {
  const params = new URLSearchParams();
  if (input.isExternal !== undefined) {
    params.set('is_external', String(input.isExternal));
  }
  if (input.sortBy) {
    params.set('sort_by', input.sortBy);
  }
  if (input.sortOrder) {
    params.set('sort_order', input.sortOrder);
  }
  const search = input.query?.trim();
  if (search) {
    params.set('q', search);
  }
  if (input.limit !== undefined) {
    params.set('limit', String(input.limit));
  }
  if (input.offset !== undefined) {
    params.set('offset', String(input.offset));
  }
  const query = params.toString();
  return await fetchBrain(`/people${query ? `?${query}` : ''}`, PeopleResponseSchema);
}

export async function listKnowledge(input: ListKnowledgeInput = {}) {
  const params = new URLSearchParams({ view: 'preview' });
  const search = input.q?.trim();
  if (search) {
    params.set('q', search);
  }
  if (input.knowledgeTypeId) {
    params.set('knowledge_type_id', input.knowledgeTypeId);
  }
  if (input.limit !== undefined) {
    params.set('limit', String(input.limit));
  }
  if (input.offset !== undefined) {
    params.set('offset', String(input.offset));
  }
  return await fetchBrain(`/knowledge?${params.toString()}`, KnowledgePreviewResponseSchema);
}

export async function listKnowledgeTypes() {
  return await fetchBrain('/knowledge-types', KnowledgeTypesResponseSchema);
}

export async function getPerson(id: string) {
  return await fetchBrain(`/people/${id}`, PersonDetailsSchema);
}

export async function updatePerson(id: string, input: PersonUpdateInput) {
  return await fetchBrain(`/people/${id}`, PersonDetailsSchema, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

function startOfDayIso(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function exclusiveEndOfDayIso(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + NEXT_DAY_OFFSET);
  return parsed.toISOString();
}

const API_BASE = '/api';

async function fetchBrain<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === HTTP_UNAUTHORIZED) {
      redirectToSignIn();
    }
    const message = await response.text();
    throw new BrainApiError(errorMessage(response.status, message), response.status);
  }

  return schema.parse(await response.json());
}

function errorMessage(status: number, message: string) {
  if (status === HTTP_UNAUTHORIZED) {
    return 'Your session has expired. Redirecting to sign in...';
  }
  if (message.length > EMPTY_COUNT) {
    return `Brain API ${status}: ${message}`;
  }
  return `Brain API ${status}: request failed.`;
}
