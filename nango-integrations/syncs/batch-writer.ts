import type { z } from 'zod';

import type { CompanyBrainRecord } from './company-brain-record.js';

type MaybePromise<T> = T | Promise<T>;

type BatchSaveNango<TRecord extends CompanyBrainRecord> = {
  batchSave(records: TRecord[], model: string): MaybePromise<unknown>;
};

type BatchWriterOptions<TRecord extends CompanyBrainRecord> = {
  nango: BatchSaveNango<TRecord>;
  model: string;
  batchSize: number;
  schema: z.ZodType<TRecord>;
  afterSave?: (records: readonly TRecord[], model: string) => MaybePromise<void>;
};

export class BatchWriter<TRecord extends CompanyBrainRecord> {
  private readonly pending: TRecord[] = [];

  constructor(private readonly options: BatchWriterOptions<TRecord>) {}

  async save(record: TRecord): Promise<void> {
    this.pending.push(this.options.schema.parse(record));

    if (this.pending.length >= this.options.batchSize) {
      await this.flush();
    }
  }

  async saveMany(records: readonly TRecord[]): Promise<void> {
    for (const record of records) {
      await this.save(record);
    }
  }

  async flush(): Promise<void> {
    if (this.pending.length === 0) {
      return;
    }

    const records = this.pending.splice(0, this.pending.length);
    await Promise.resolve(this.options.nango.batchSave(records, this.options.model));
    if (this.options.afterSave) {
      await Promise.resolve(this.options.afterSave(records, this.options.model));
    }
  }
}
