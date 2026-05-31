import { z } from 'zod';

export const CompanyBrainRecordSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1),
});

export type CompanyBrainRecord = z.infer<typeof CompanyBrainRecordSchema>;

export function defineCompanyBrainRecord<TShape extends z.ZodRawShape>(shape: TShape) {
  if ('id' in shape || 'body' in shape) {
    throw new Error('Company Brain records define id and body through CompanyBrainRecordSchema');
  }

  return CompanyBrainRecordSchema.extend(shape);
}
