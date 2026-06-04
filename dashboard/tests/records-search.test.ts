import { describe, expect, it } from 'vitest';
import {
  cleanRouteSearch,
  dayKey,
  normalizeRouteSearch,
  toRecordsQueryInput,
} from '../src/lib/records-search.ts';

describe('records route search helpers', () => {
  it('normalizes unknown search params into dashboard defaults', () => {
    expect(normalizeRouteSearch({ limit: 'bad' })).toEqual({
      tab: undefined,
      q: undefined,
      dataSourceId: undefined,
      personId: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      limit: 20,
      selectedRecordId: undefined,
    });
  });

  it('maps route state to the records API input without selected row state', () => {
    expect(
      toRecordsQueryInput({
        q: 'roadmap',
        tab: 'people',
        dataSourceId: '019e8882-07f1-771c-993e-f6825a9224bb',
        personId: '019e8882-07f1-77a0-b4cf-5798eafb4664',
        createdAfter: '2026-06-01',
        createdBefore: '2026-06-04',
        sortBy: 'created_at',
        sortOrder: 'desc',
        limit: 50,
        selectedRecordId: '019e8882-07f1-77e9-93cd-084f3e8491b2',
      }),
    ).toEqual({
      q: 'roadmap',
      dataSourceId: '019e8882-07f1-771c-993e-f6825a9224bb',
      personId: '019e8882-07f1-77a0-b4cf-5798eafb4664',
      createdAfter: '2026-06-01',
      createdBefore: '2026-06-04',
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit: 50,
    });
  });

  it('removes empty values before writing search params', () => {
    expect(
      cleanRouteSearch({
        q: '',
        tab: 'records',
        dataSourceId: '',
        personId: '',
        createdAfter: '',
        createdBefore: '',
        sortBy: undefined,
        sortOrder: undefined,
        limit: 20,
        selectedRecordId: '',
      }),
    ).toEqual({
      tab: undefined,
      q: undefined,
      dataSourceId: undefined,
      personId: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      limit: 20,
      selectedRecordId: undefined,
    });
  });

  it('keeps the people tab in route search params', () => {
    expect(normalizeRouteSearch({ tab: 'people' }).tab).toBe('people');
    expect(cleanRouteSearch({ ...normalizeRouteSearch({ tab: 'people' }) }).tab).toBe('people');
  });

  it('derives day keys from ISO timestamps', () => {
    expect(dayKey('2026-06-04T12:30:00.000Z')).toBe('2026-06-04');
  });
});
