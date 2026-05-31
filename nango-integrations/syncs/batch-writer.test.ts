import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { BatchWriter } from './batch-writer.js';
import { type CompanyBrainRecord, defineCompanyBrainRecord } from './company-brain-record.js';

const TestRecordSchema = defineCompanyBrainRecord({
  title: z.string(),
});

type TestRecord = z.infer<typeof TestRecordSchema>;

describe('BatchWriter', () => {
  it('validates records before saving them', async () => {
    const saved: TestRecord[] = [];
    const writer = new BatchWriter({
      nango: {
        batchSave(records) {
          saved.push(...records);
        },
      },
      model: 'TestRecord',
      batchSize: 1,
      schema: TestRecordSchema,
    });

    await expect(
      writer.save({ id: 'record-1', title: 'Missing body' } as unknown as TestRecord),
    ).rejects.toThrow();

    expect(saved).toEqual([]);
  });

  it('runs the post-save hook after the batch is saved', async () => {
    const calls: string[] = [];
    const writer = new BatchWriter({
      nango: {
        batchSave(records) {
          calls.push(`save:${records.length}`);
        },
      },
      model: 'TestRecord',
      batchSize: 2,
      schema: TestRecordSchema,
      afterSave(records) {
        calls.push(`after:${records.length}`);
      },
    });

    await writer.save({ id: 'record-1', body: 'Body 1', title: 'One' });
    await writer.save({ id: 'record-2', body: 'Body 2', title: 'Two' });

    expect(calls).toEqual(['save:2', 'after:2']);
  });

  it('allows shared fields to be reused through the base record type', () => {
    const record: CompanyBrainRecord = TestRecordSchema.parse({
      id: 'record-1',
      body: 'Readable Markdown body',
      title: 'One',
    });

    expect(record.body).toBe('Readable Markdown body');
  });
});
