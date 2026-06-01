import { z } from 'zod';

import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';

export const NotionReferenceSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
});

export const NotionParentSchema = z.object({
  type: z.enum(['workspace', 'page', 'data_source', 'database', 'block', 'agent', 'unknown']),
  title: z.string().optional(),
  url: z.string().optional(),
});

export const NotionPropertySchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const NotionPersonSchema = z.object({
  identifier: z.string(),
});

export const NotionFileSchema = z.object({
  kind: z.string(),
  name: z.string().optional(),
  caption: z.string().optional(),
  url: z.string().optional(),
});

export const NotionLinkSchema = z.object({
  url: z.string(),
  text: z.string().optional(),
});

export const NotionPageSchema = defineCompanyBrainRecord({
  title: z.string(),
  url: z.string(),
  public_url: z.string().optional(),
  parent: NotionParentSchema,
  created_at: z.string(),
  updated_at: z.string(),
  created_by: NotionPersonSchema.optional(),
  updated_by: NotionPersonSchema.optional(),
  people: z.array(NotionPersonSchema).optional(),
  mentioned_people: z.array(NotionPersonSchema).optional(),
  content: z.string().optional(),
  properties: z.array(NotionPropertySchema).optional(),
  files: z.array(NotionFileSchema).optional(),
  links: z.array(NotionLinkSchema).optional(),
  child_pages: z.array(NotionReferenceSchema).optional(),
  child_databases: z.array(NotionReferenceSchema).optional(),
  related_pages: z.array(NotionReferenceSchema).optional(),
});

export const MetadataSchema = z.object({
  pageSize: z.number().optional().describe('Notion API page size for paginated reads'),
  batchSize: z.number().optional().describe('How many page records to save per batch'),
  maxPagesPerRun: z
    .number()
    .optional()
    .describe('Optional cap for page records processed in one run'),
  maxBlockDepth: z
    .number()
    .optional()
    .describe('Maximum block nesting depth to render for each page'),
  includeTrashed: z.boolean().optional().describe('Whether to include pages that are in trash'),
});

export type NotionFile = z.infer<typeof NotionFileSchema>;
export type NotionLink = z.infer<typeof NotionLinkSchema>;
export type NotionPage = z.infer<typeof NotionPageSchema>;
export type NotionParent = z.infer<typeof NotionParentSchema>;
export type NotionPerson = z.infer<typeof NotionPersonSchema>;
export type NotionProperty = z.infer<typeof NotionPropertySchema>;
export type NotionReference = z.infer<typeof NotionReferenceSchema>;
export type SyncMetadata = z.infer<typeof MetadataSchema>;
