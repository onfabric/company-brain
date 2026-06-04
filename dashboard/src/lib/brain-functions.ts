import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  API_MAX_LIMIT,
  DEFAULT_BRAIN_BASE_URL,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  EMPTY_COUNT,
  EMPTY_OFFSET,
  FIRST_PAGE,
  NEXT_DAY_OFFSET,
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

const PersonFilterSchema = z.object({
  is_external: z.boolean().optional(),
});

const PeopleResponseSchema = z.object({
  people: z.array(
    PersonSchema.extend({
      data_sources: z.array(PersonDataSourceSchema),
      records_count: z.number().int(),
    }),
  ),
});

const RecordsQueryInputSchema = z.object({
  q: z.string().optional(),
  dataSourceId: z.uuid().optional(),
  personId: z.uuid().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  page: z.number().int().min(FIRST_PAGE).default(DEFAULT_PAGE),
  limit: z.number().int().min(FIRST_PAGE).max(API_MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type RecordHit = z.infer<typeof RecordHitSchema>;
export type RecordsResponse = z.infer<typeof RecordsResponseSchema>;
export type RecordsQueryInput = z.infer<typeof RecordsQueryInputSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Person = z.infer<typeof PeopleResponseSchema>['people'][number];

export const listRecords = createServerFn({ method: 'GET' })
  .inputValidator(RecordsQueryInputSchema)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    const query = data.q?.trim();
    if (query) {
      params.set('q', query);
    }
    if (data.dataSourceId) {
      params.set('data_source_id', data.dataSourceId);
    }
    if (data.personId) {
      params.append('person_id', data.personId);
    }
    if (data.createdAfter) {
      params.set('created_after', startOfDayIso(data.createdAfter));
    }
    if (data.createdBefore) {
      params.set('created_before', exclusiveEndOfDayIso(data.createdBefore));
    }

    params.set('limit', String(data.limit));
    params.set('offset', String(pageToOffset(data.page, data.limit)));

    return await fetchBrain(`/records?${params.toString()}`, RecordsResponseSchema);
  });

export const listDataSources = createServerFn({ method: 'GET' }).handler(async () => {
  return await fetchBrain('/data-sources', SourcesResponseSchema);
});

export const listPeople = createServerFn({ method: 'GET' })
  .inputValidator(PersonFilterSchema)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    if (data.is_external !== undefined) {
      params.set('is_external', String(data.is_external));
    }
    const suffix = params.size > EMPTY_COUNT ? `?${params.toString()}` : '';
    return await fetchBrain(`/people${suffix}`, PeopleResponseSchema);
  });

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

async function fetchBrain<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const baseUrl = process.env.BRAIN_BASE_URL ?? DEFAULT_BRAIN_BASE_URL;
  const apiKey = process.env.BRAIN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing BRAIN_API_KEY for dashboard API calls.');
  }

  const response = await fetch(new URL(path, baseUrl), {
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Brain API ${response.status}: ${message}`);
  }

  return schema.parse(await response.json());
}
