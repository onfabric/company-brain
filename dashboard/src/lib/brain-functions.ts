import { z } from 'zod';
import {
  API_MAX_LIMIT,
  DATE_SLICE_END,
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

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const NO_PARTICIPANTS_PERSON_ID = 'none';

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

const RecordFilesystemFolderSchema = z.object({
  type: z.enum(['provider', 'day', 'participant']),
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
});

const RecordFilesystemResponseSchema = z.object({
  path: z.object({
    data_source_id: z.uuid().optional(),
    data_source_key: z.string().optional(),
    day: z.string().optional(),
    person_id: z.string().optional(),
    participant_name: z.string().optional(),
  }),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  folders: z.array(RecordFilesystemFolderSchema),
  records: z.array(RecordHitSchema),
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
export type RecordFilesystemResponse = z.infer<typeof RecordFilesystemResponseSchema>;
export type RecordFilesystemFolder = z.infer<typeof RecordFilesystemFolderSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Person = z.infer<typeof PersonDetailsSchema>;
export type PersonUpdateInput = Partial<Pick<Person, 'name' | 'email' | 'is_external'>>;
export type RecordFilesystemInput = {
  dataSourceId?: string;
  day?: string;
  personId?: string;
  limit?: number;
  offset?: number;
};
export type ListPeopleInput = {
  isExternal?: boolean;
  sortBy?: PeopleSortField;
  sortOrder?: PeopleSortOrder;
  query?: string;
  limit?: number;
  offset?: number;
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
  params.set('offset', String(input.offset));

  return await fetchBrain(`/records?${params.toString()}`, RecordsResponseSchema, apiKey);
}

export async function listRecordFilesystem(input: RecordFilesystemInput, apiKey: string) {
  const params = new URLSearchParams();
  if (input.dataSourceId) {
    params.set('data_source_id', input.dataSourceId);
  }
  if (input.day) {
    params.set('day', input.day);
  }
  if (input.personId) {
    params.set('person_id', input.personId);
  }
  if (input.limit !== undefined) {
    params.set('limit', String(input.limit));
  }
  if (input.offset !== undefined) {
    params.set('offset', String(input.offset));
  }

  const query = params.toString();
  try {
    return await fetchBrain(
      `/records/filesystem${query ? `?${query}` : ''}`,
      RecordFilesystemResponseSchema,
      apiKey,
    );
  } catch (error) {
    if (isMissingFilesystemEndpoint(error)) {
      return await listRecordFilesystemFromSearch(input, apiKey);
    }
    throw error;
  }
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
  return await fetchBrain(`/people${query ? `?${query}` : ''}`, PeopleResponseSchema, apiKey);
}

export async function getPerson(id: string, apiKey: string) {
  return await fetchBrain(`/people/${id}`, PersonDetailsSchema, apiKey);
}

export async function updatePerson(id: string, input: PersonUpdateInput, apiKey: string) {
  return await fetchBrain(`/people/${id}`, PersonDetailsSchema, apiKey, {
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

async function listRecordFilesystemFromSearch(
  input: RecordFilesystemInput,
  apiKey: string,
): Promise<RecordFilesystemResponse> {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const offset = input.offset ?? EMPTY_OFFSET;
  const { sources } = await listDataSources(apiKey);
  const source = sources.find((item) => item.data_source_id === input.dataSourceId);

  if (!input.dataSourceId) {
    const folders = sources.map((item) => ({
      type: 'provider' as const,
      id: item.data_source_id,
      name: item.data_source_key,
      count: item.count,
    }));
    return {
      path: {},
      total: sumFolderCounts(folders),
      limit,
      offset,
      folders,
      records: [],
    };
  }

  if (!input.day) {
    const folders = await listDayFoldersFromSearch(input.dataSourceId, apiKey);
    return {
      path: {
        data_source_id: input.dataSourceId,
        data_source_key: source?.data_source_key,
      },
      total: sumFolderCounts(folders),
      limit,
      offset,
      folders,
      records: [],
    };
  }

  if (!input.personId) {
    const folders = await listParticipantFoldersFromSearch(input.dataSourceId, input.day, apiKey);
    return {
      path: {
        data_source_id: input.dataSourceId,
        data_source_key: source?.data_source_key,
        day: input.day,
      },
      total: sumFolderCounts(folders),
      limit,
      offset,
      folders,
      records: [],
    };
  }

  const page =
    input.personId === NO_PARTICIPANTS_PERSON_ID
      ? await listNoParticipantRecordsFromSearch(
          input.dataSourceId,
          input.day,
          limit,
          offset,
          apiKey,
        )
      : await listRecords(
          {
            dataSourceId: input.dataSourceId,
            personId: input.personId,
            createdAfter: input.day,
            createdBefore: input.day,
            sortBy: 'created_at',
            sortOrder: 'desc',
            limit,
            offset,
          },
          apiKey,
        );

  return {
    path: {
      data_source_id: input.dataSourceId,
      data_source_key: source?.data_source_key,
      day: input.day,
      person_id: input.personId,
      participant_name: await participantNameFromFilesystemPage(
        input.personId,
        page.results,
        apiKey,
      ),
    },
    total: page.total ?? page.results.length,
    limit,
    offset,
    folders: [],
    records: page.results,
  };
}

async function listDayFoldersFromSearch(dataSourceId: string, apiKey: string) {
  const { records } = await listAllRecords(
    {
      dataSourceId,
      sortBy: 'created_at',
      sortOrder: 'desc',
    },
    apiKey,
  );
  const counts = new Map<string, number>();
  records.forEach((record) => {
    const day = recordDayKey(record.created_at);
    counts.set(day, (counts.get(day) ?? EMPTY_COUNT) + NEXT_DAY_OFFSET);
  });
  return [...counts.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([day, count]) => ({
      type: 'day' as const,
      id: day,
      name: day,
      count,
    }));
}

async function listParticipantFoldersFromSearch(dataSourceId: string, day: string, apiKey: string) {
  const { records } = await listAllRecords(
    {
      dataSourceId,
      createdAfter: day,
      createdBefore: day,
      sortBy: 'created_at',
      sortOrder: 'desc',
    },
    apiKey,
  );
  const folders = new Map<string, { name: string; count: number }>();
  let noParticipantsCount = EMPTY_COUNT;

  records.forEach((record) => {
    if (record.participants.length === EMPTY_COUNT) {
      noParticipantsCount += NEXT_DAY_OFFSET;
      return;
    }

    const seen = new Set<string>();
    record.participants.forEach((participant) => {
      if (seen.has(participant.id)) {
        return;
      }
      seen.add(participant.id);
      const folder = folders.get(participant.id);
      folders.set(participant.id, {
        name: folder?.name ?? apiParticipantName(participant),
        count: (folder?.count ?? EMPTY_COUNT) + NEXT_DAY_OFFSET,
      });
    });
  });

  const participantFolders = [...folders.entries()]
    .map(([id, folder]) => ({
      type: 'participant' as const,
      id,
      name: folder.name,
      count: folder.count,
    }))
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  if (noParticipantsCount > EMPTY_COUNT) {
    participantFolders.push({
      type: 'participant' as const,
      id: NO_PARTICIPANTS_PERSON_ID,
      name: 'No participants',
      count: noParticipantsCount,
    });
  }

  return participantFolders;
}

async function listNoParticipantRecordsFromSearch(
  dataSourceId: string,
  day: string,
  limit: number,
  offset: number,
  apiKey: string,
): Promise<RecordsResponse> {
  const { records } = await listAllRecords(
    {
      dataSourceId,
      createdAfter: day,
      createdBefore: day,
      sortBy: 'created_at',
      sortOrder: 'desc',
    },
    apiKey,
  );
  const matches = records.filter((record) => record.participants.length === EMPTY_COUNT);
  return {
    total: matches.length,
    limit,
    offset,
    results: matches.slice(offset, offset + limit),
  };
}

async function listAllRecords(input: Omit<RecordsQueryInput, 'limit' | 'offset'>, apiKey: string) {
  const records: RecordHit[] = [];
  let offset = EMPTY_OFFSET;
  let total = API_MAX_LIMIT;

  while (records.length < total) {
    const page = await listRecords({ ...input, limit: API_MAX_LIMIT, offset }, apiKey);
    records.push(...page.results);
    total = page.total ?? records.length;
    if (page.results.length === EMPTY_COUNT) {
      break;
    }
    offset += page.limit;
  }

  return { records, total };
}

async function participantNameFromFilesystemPage(
  personId: string,
  records: RecordHit[],
  apiKey: string,
) {
  if (personId === NO_PARTICIPANTS_PERSON_ID) {
    return 'No participants';
  }
  const participant = records
    .flatMap((record) => record.participants)
    .find((item) => item.id === personId);
  if (participant) {
    return apiParticipantName(participant);
  }
  try {
    return apiParticipantName(await getPerson(personId, apiKey));
  } catch {
    return personId;
  }
}

function isMissingFilesystemEndpoint(error: unknown) {
  if (!(error instanceof BrainApiError)) {
    return false;
  }
  if (error.status === HTTP_NOT_FOUND) {
    return true;
  }
  return error.status === HTTP_BAD_REQUEST && error.message.includes('filesystem');
}

function sumFolderCounts(folders: Array<{ count: number }>) {
  return folders.reduce((sum, folder) => sum + folder.count, EMPTY_COUNT);
}

function recordDayKey(value: string) {
  return value.slice(EMPTY_COUNT, DATE_SLICE_END);
}

function apiParticipantName(participant: {
  id: string;
  name: string | null;
  email: string | null;
  handle?: string | null;
  data_sources?: Array<{ data_source_user_id: string }>;
}) {
  return (
    participant.name ??
    participant.email ??
    participant.handle ??
    participant.data_sources?.[EMPTY_COUNT]?.data_source_user_id ??
    participant.id
  );
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
