import { z } from 'zod';

import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';

export const GmailAttachmentSchema = z.object({
  filename: z.string(),
  mime_type: z.string().optional(),
  size: z.number().optional(),
});

export const GmailMessageSchema = z.object({
  sent_at: z.iso.datetime({ offset: true }),
  from: z.string().optional(),
  to: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string().optional(),
  labels: z.array(z.string()).optional(),
  text: z.string(),
  attachments: z.array(GmailAttachmentSchema).optional(),
});

export const GmailThreadSchema = defineCompanyBrainRecord({
  mailbox: z.string().optional(),
  subject: z.string(),
  labels: z.array(z.string()).optional(),
  messages: z.array(GmailMessageSchema),
});

export type GmailAttachment = z.infer<typeof GmailAttachmentSchema>;
export type GmailMessage = z.infer<typeof GmailMessageSchema>;
export type GmailThread = z.infer<typeof GmailThreadSchema>;
