import type { RawNotionDatabase, RawNotionDataSource } from './api-types.js';
import type { NotionPage, NotionReference, SyncMetadata } from './models.js';

export type NangoRequest = {
  endpoint: string;
  data?: unknown;
  params?: string | Record<string, string | number | string[] | number[]>;
  headers?: Record<string, string>;
  retries?: number;
};

export type NangoApiResponse = {
  data: unknown;
};

type MaybePromise<T> = T | Promise<T>;

export type NangoLike = {
  getMetadata(): Promise<unknown>;
  get(config: NangoRequest): Promise<NangoApiResponse>;
  post(config: NangoRequest): Promise<NangoApiResponse>;
  batchSave(records: NotionPage[], model: string): MaybePromise<unknown>;
};

export type SyncContext = {
  nango: NangoLike;
  metadata: SyncMetadata | undefined;
  pageRefsById: Map<string, NotionReference>;
  databaseRefsById: Map<string, NotionReference>;
  dataSourceRefsById: Map<string, NotionReference>;
  dataSourcesById: Map<string, RawNotionDataSource>;
  databasesById: Map<string, RawNotionDatabase>;
};

export class WorkQueue {
  private readonly queued = new Set<string>();
  private readonly processed = new Set<string>();
  private readonly values: string[] = [];

  add(value: string): void {
    if (!value || this.queued.has(value) || this.processed.has(value)) {
      return;
    }

    this.queued.add(value);
    this.values.push(value);
  }

  addMany(values: string[]): void {
    for (const value of values) {
      this.add(value);
    }
  }

  hasNext(): boolean {
    return this.values.length > 0;
  }

  next(): string {
    const value = this.values.shift();
    if (!value) {
      return '';
    }

    this.queued.delete(value);
    this.processed.add(value);
    return value;
  }
}
