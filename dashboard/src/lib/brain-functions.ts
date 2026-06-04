import { z } from 'zod';
import {
  API_MAX_LIMIT,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
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

const RecordHitSchema = z
  .object({
    id: z.uuid(),
    data_source_id: z.uuid(),
    data_source_key: z.string().optional(),
    created_at: z.iso.datetime(),
    updated_at: z.iso.datetime(),
    body: z.string(),
    participants: z.array(PersonSchema).default([]),
    score: z.number().nullable(),
    snippet: z.string().nullable(),
  })
  .transform((record) => ({
    ...record,
    data_source_key: record.data_source_key ?? record.data_source_id,
  }));

const RecordsResponseSchema = z.object({
  total: z.number().int(),
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
  people: z.array(PersonDetailsSchema),
});

const MergePeopleResponseSchema = z.object({
  person: PersonDetailsSchema,
  moved_data_sources: z.number().int(),
  moved_records: z.number().int(),
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
  page: z.number().int().min(FIRST_PAGE).default(DEFAULT_PAGE),
  limit: z.number().int().min(FIRST_PAGE).max(API_MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PeopleSortField = (typeof PEOPLE_SORT_FIELDS)[number];
export type PeopleSortOrder = (typeof PEOPLE_SORT_ORDERS)[number];
export type RecordHit = z.infer<typeof RecordHitSchema>;
export type RecordsResponse = z.infer<typeof RecordsResponseSchema>;
export type RecordsQueryInput = z.infer<typeof RecordsQueryInputSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Person = z.infer<typeof PersonDetailsSchema>;
export type PersonUpdateInput = Partial<Pick<Person, 'name' | 'email' | 'is_external'>>;
export type ListPeopleInput = {
  isExternal?: boolean;
  sortBy?: PeopleSortField;
  sortOrder?: PeopleSortOrder;
};

export async function listRecords(input: RecordsQueryInput, apiKey: string) {
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
  params.set('offset', String(pageToOffset(input.page, input.limit)));

  return await fetchBrain(`/records?${params.toString()}`, RecordsResponseSchema, apiKey);
}

export async function listDataSources(apiKey: string) {
  return await fetchBrain('/data-sources', SourcesResponseSchema, apiKey);
}

export async function listPeople(apiKey: string, input: ListPeopleInput = {}) {
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
  const query = params.toString();
  return await fetchBrain(`/people${query ? `?${query}` : ''}`, PeopleResponseSchema, apiKey);
}

export async function updatePerson(id: string, input: PersonUpdateInput, apiKey: string) {
  return await fetchBrain(`/people/${id}`, PersonDetailsSchema, apiKey, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function mergePeople(
  input: { mergeFromId: string; mergeIntoId: string },
  apiKey: string,
) {
  return await fetchBrain('/people/merge', MergePeopleResponseSchema, apiKey, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      merge_from_id: input.mergeFromId,
      merge_into_id: input.mergeIntoId,
    }),
  });
}

function pageToOffset(page: number, limit: number) {
  return page > FIRST_PAGE ? (page - FIRST_PAGE) * limit : EMPTY_OFFSET;
}

function startOfDayIso(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function exclusiveEndOfDayIso(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + NEXT_DAY_OFFSET);
  return parsed.toISOString();
}

async function fetchBrain<T>(
  path: string,
  schema: z.ZodType<T>,
  apiKey: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('api-key', apiKey);
  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new BrainApiError(errorMessage(response.status, message), response.status);
  }

  return schema.parse(await response.json());
}

function errorMessage(status: number, message: string) {
  if (status === HTTP_UNAUTHORIZED) {
    return 'That API key was rejected.';
  }
  if (message.length > EMPTY_COUNT) {
    return `Brain API ${status}: ${message}`;
  }
  return `Brain API ${status}: request failed.`;
}
