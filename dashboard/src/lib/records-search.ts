import type { RecordsQueryInput } from '#/lib/brain-functions.ts';
import {
  API_MAX_LIMIT,
  DASHBOARD_TABS,
  DATE_SLICE_END,
  DEFAULT_LIMIT,
  EMPTY_COUNT,
  LIMIT_OPTIONS,
  RECORD_SORT_FIELDS,
  RECORD_SORT_ORDERS,
} from '#/lib/constants.ts';

export type RecordSortField = (typeof RECORD_SORT_FIELDS)[number];
export type RecordSortOrder = (typeof RECORD_SORT_ORDERS)[number];
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export type RecordsRouteSearch = {
  tab?: DashboardTab;
  q?: string;
  dataSourceId?: string;
  personId?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: RecordSortField;
  sortOrder?: RecordSortOrder;
  limit: number;
  selectedRecordId?: string;
  knowledgeQ?: string;
  selectedKnowledgeId?: string;
};

export function normalizeRouteSearch(search: Record<string, unknown>): RecordsRouteSearch {
  return {
    tab: dashboardTabValue(search.tab),
    q: stringValue(search.q),
    dataSourceId: stringValue(search.dataSourceId),
    personId: stringValue(search.personId),
    createdAfter: stringValue(search.createdAfter),
    createdBefore: stringValue(search.createdBefore),
    sortBy: sortFieldValue(search.sortBy),
    sortOrder: sortOrderValue(search.sortOrder),
    limit: limitValue(search.limit),
    selectedRecordId: stringValue(search.selectedRecordId),
    knowledgeQ: stringValue(search.knowledgeQ),
    selectedKnowledgeId: stringValue(search.selectedKnowledgeId),
  };
}

export function toRecordsQueryInput(search: RecordsRouteSearch): Omit<RecordsQueryInput, 'offset'> {
  return {
    q: search.q,
    dataSourceId: search.dataSourceId,
    personId: search.personId,
    createdAfter: search.createdAfter,
    createdBefore: search.createdBefore,
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
    limit: search.limit,
  };
}

export function cleanRouteSearch(search: RecordsRouteSearch): RecordsRouteSearch {
  return {
    tab: search.tab && search.tab !== 'records' ? search.tab : undefined,
    q: search.q || undefined,
    dataSourceId: search.dataSourceId || undefined,
    personId: search.personId || undefined,
    createdAfter: search.createdAfter || undefined,
    createdBefore: search.createdBefore || undefined,
    sortBy: search.sortBy || undefined,
    sortOrder: search.sortOrder || undefined,
    limit: search.limit,
    selectedRecordId: search.selectedRecordId || undefined,
    knowledgeQ: search.knowledgeQ || undefined,
    selectedKnowledgeId: search.selectedKnowledgeId || undefined,
  };
}

export function dayKey(value: string) {
  return value.slice(EMPTY_COUNT, DATE_SLICE_END);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.length > EMPTY_COUNT ? value : undefined;
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > EMPTY_COUNT ? parsed : fallback;
}

function limitValue(value: unknown) {
  const parsed = positiveInteger(value, DEFAULT_LIMIT);
  if (LIMIT_OPTIONS.includes(parsed as (typeof LIMIT_OPTIONS)[number])) {
    return parsed;
  }
  return parsed <= API_MAX_LIMIT ? parsed : DEFAULT_LIMIT;
}

function sortFieldValue(value: unknown) {
  return RECORD_SORT_FIELDS.includes(value as RecordSortField)
    ? (value as RecordSortField)
    : undefined;
}

function sortOrderValue(value: unknown) {
  return RECORD_SORT_ORDERS.includes(value as RecordSortOrder)
    ? (value as RecordSortOrder)
    : undefined;
}

function dashboardTabValue(value: unknown) {
  return DASHBOARD_TABS.includes(value as DashboardTab) ? (value as DashboardTab) : undefined;
}
