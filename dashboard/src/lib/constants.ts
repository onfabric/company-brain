export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const PEOPLE_PAGE_SIZE = 25;
export const API_MAX_LIMIT = 100;
export const HTTP_UNAUTHORIZED = 401;
export const COMPACT_LIMIT = 10;
export const EXPANDED_LIMIT = 50;
export const FIRST_PAGE = 1;
export const EMPTY_COUNT = 0;
export const EMPTY_OFFSET = 0;
export const NEXT_DAY_OFFSET = 1;
export const LIMIT_OPTIONS = [COMPACT_LIMIT, DEFAULT_LIMIT, EXPANDED_LIMIT, API_MAX_LIMIT] as const;
export const EMPTY_OPTION_VALUE = 'all';
export const PARTICIPANT_SEARCH_LIMIT = 25;
export const SEARCH_DEBOUNCE_MS = 200;
export const RECORD_PREVIEW_LINES = 3;
export const DATE_SLICE_END = 10;
export const RECORD_SORT_FIELDS = ['created_at', 'updated_at', 'relevance'] as const;
export const RECORD_SORT_ORDERS = ['asc', 'desc'] as const;
export const PEOPLE_SORT_FIELDS = ['name', 'records_count'] as const;
export const PEOPLE_SORT_ORDERS = ['asc', 'desc'] as const;
export const DEFAULT_PEOPLE_SORT_FIELD =
  'records_count' satisfies (typeof PEOPLE_SORT_FIELDS)[number];
export const DEFAULT_PEOPLE_SORT_ORDER = 'desc' satisfies (typeof PEOPLE_SORT_ORDERS)[number];
export const DASHBOARD_TABS = ['records', 'filesystem', 'people'] as const;
export const DATE_TIME_FORMAT_OPTIONS = {
  dateStyle: 'medium',
  timeStyle: 'short',
} satisfies Intl.DateTimeFormatOptions;
