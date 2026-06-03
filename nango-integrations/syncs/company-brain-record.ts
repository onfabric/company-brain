import { z } from 'zod';

// Timestamps are ISO 8601 strings, not Date objects: records are JSON-serialized
// into Nango storage, so a Date would not survive the round-trip. Offsets are
// allowed to preserve the provider's timezone (see SYNC_GUIDELINES). The backend
// casts these to timestamptz when reading them into brain.records.
export const CompanyBrainRecordSchema = z.object({
  id: z.string().min(1),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  body: z.string().min(1),
  participants: z.array(z.string().min(1)),
});

export type CompanyBrainRecord = z.infer<typeof CompanyBrainRecordSchema>;

const RESERVED_KEYS = ['id', 'created_at', 'updated_at', 'body', 'participants'] as const;

export function defineCompanyBrainRecord<TShape extends z.ZodRawShape>(shape: TShape) {
  const reserved = RESERVED_KEYS.find((key) => key in shape);
  if (reserved) {
    throw new Error(`Company Brain records define ${reserved} through CompanyBrainRecordSchema`);
  }

  return CompanyBrainRecordSchema.extend(shape);
}
