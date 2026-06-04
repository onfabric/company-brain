export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
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
export const RECORD_PREVIEW_LINES = 3;
export const SCORE_PRECISION = 2;
export const DATE_SLICE_END = 10;
export const RECORD_SORT_FIELDS = ['created_at', 'updated_at', 'relevance'] as const;
export const RECORD_SORT_ORDERS = ['asc', 'desc'] as const;
export const DATE_TIME_FORMAT_OPTIONS = {
  dateStyle: 'medium',
  timeStyle: 'short',
} satisfies Intl.DateTimeFormatOptions;
