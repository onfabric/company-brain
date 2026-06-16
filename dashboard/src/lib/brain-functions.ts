import { brain, unwrap } from '#/lib/brain-client.ts';
import { NEXT_DAY_OFFSET } from '#/lib/constants.ts';

type ResponseData<T> = Awaited<T> extends { data: infer D } ? NonNullable<D> : never;
type RecordsQuery = NonNullable<NonNullable<Parameters<typeof brain.api.records.get>[0]>['query']>;
type PeopleQuery = NonNullable<NonNullable<Parameters<typeof brain.api.people.get>[0]>['query']>;

export type ListRecordsResponse = ResponseData<ReturnType<typeof brain.api.records.get>>;
export type RecordHit = ListRecordsResponse['results'][number];
export type ListDataSourcesResponse = ResponseData<
  ReturnType<(typeof brain.api)['data-sources']['get']>
>;
export type Source = ListDataSourcesResponse['sources'][number];
export type ListPeopleResponse = ResponseData<ReturnType<typeof brain.api.people.get>>;
export type Person = ListPeopleResponse['people'][number];
export type UpdatePersonInput = Partial<Pick<Person, 'name' | 'email' | 'is_external'>>;
export type ListKnowledgeResponse = ResponseData<ReturnType<typeof brain.api.knowledge.get>>;
export type KnowledgePreview = ListKnowledgeResponse['results'][number];
export type ListKnowledgeTypesResponse = ResponseData<
  ReturnType<(typeof brain.api)['knowledge-types']['get']>
>;
export type KnowledgeType = ListKnowledgeTypesResponse['knowledge_types'][number];
export type ListApiKeysResponse = ResponseData<ReturnType<(typeof brain.api)['api-keys']['get']>>;
export type ApiKey = ListApiKeysResponse['api_keys'][number];
export type CreatedApiKey = ResponseData<ReturnType<(typeof brain.api)['api-keys']['post']>>;

export type PeopleSortField = NonNullable<PeopleQuery['sort_by']>;
export type PeopleSortOrder = NonNullable<PeopleQuery['sort_order']>;

export type ListRecordsInput = {
  q?: string;
  dataSourceId?: string;
  personId?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: NonNullable<RecordsQuery['sort_by']>;
  sortOrder?: NonNullable<RecordsQuery['sort_order']>;
  offset: number;
  limit: number;
};

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

export async function listRecords(input: ListRecordsInput): Promise<ListRecordsResponse> {
  return unwrap(
    await brain.api.records.get({
      query: {
        q: cleanString(input.q),
        data_source_id: input.dataSourceId,
        person_id: input.personId ? [input.personId] : undefined,
        created_after: input.createdAfter ? startOfDayIso(input.createdAfter) : undefined,
        created_before: input.createdBefore ? exclusiveEndOfDayIso(input.createdBefore) : undefined,
        sort_by: input.sortBy,
        sort_order: input.sortOrder,
        limit: input.limit,
        offset: input.offset,
      },
    }),
  );
}

export async function listDataSources(): Promise<ListDataSourcesResponse> {
  return unwrap(await brain.api['data-sources'].get());
}

export async function listPeople(input: ListPeopleInput = {}): Promise<ListPeopleResponse> {
  return unwrap(
    await brain.api.people.get({
      query: {
        is_external: input.isExternal,
        sort_by: input.sortBy,
        sort_order: input.sortOrder,
        q: cleanString(input.query),
        limit: input.limit,
        offset: input.offset,
      },
    }),
  );
}

export async function listKnowledge(
  input: ListKnowledgeInput = {},
): Promise<ListKnowledgeResponse> {
  return unwrap(
    await brain.api.knowledge.get({
      query: {
        view: 'preview',
        q: cleanString(input.q),
        knowledge_type_id: input.knowledgeTypeId,
        limit: input.limit,
        offset: input.offset,
      },
    }),
  );
}

export async function listKnowledgeTypes(): Promise<ListKnowledgeTypesResponse> {
  return unwrap(await brain.api['knowledge-types'].get());
}

export async function getPerson(id: string): Promise<Person> {
  return unwrap(await brain.api.people({ id }).get());
}

export async function updatePerson(id: string, input: UpdatePersonInput): Promise<Person> {
  return unwrap(await brain.api.people({ id }).patch(input));
}

export async function listApiKeys(): Promise<ListApiKeysResponse> {
  return unwrap(await brain.api['api-keys'].get());
}

export async function createApiKey(name: string): Promise<CreatedApiKey> {
  return unwrap(await brain.api['api-keys'].post({ name }));
}

export async function updateApiKey(id: string, name: string): Promise<ApiKey> {
  return unwrap(await brain.api['api-keys']({ id }).patch({ name }));
}

export async function deleteApiKey(id: string): Promise<string> {
  return unwrap(await brain.api['api-keys']({ id }).delete()).id;
}

function cleanString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function startOfDayIso(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function exclusiveEndOfDayIso(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + NEXT_DAY_OFFSET);
  return parsed.toISOString();
}
