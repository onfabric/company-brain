import { createSync } from 'nango';
import { z } from 'zod';

import { BatchWriter } from '../../syncs/batch-writer.js';
import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';

const BATCH_SIZE = 50;
const WEBHOOK_TYPE = 'agent.conversation.upsert';

const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  text: z.string(),
  created_at: z.string().optional(),
  tool_name: z.string().optional(),
  files: z.array(z.string()).optional(),
});

const AgentToolEventSchema = z.object({
  name: z.string(),
  created_at: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  status: z.enum(['started', 'completed', 'failed']).optional(),
  files: z.array(z.string()).optional(),
});

const AgentConversationSchema = defineCompanyBrainRecord({
  source: z.enum(['claude-code', 'codex']),
  session_id: z.string(),
  user_identifier: z.string().optional(),
  workspace: z.string().optional(),
  repo: z.string().optional(),
  cwd: z.string().optional(),
  title: z.string().optional(),
  started_at: z.string(),
  updated_at: z.string(),
  ended_at: z.string().optional(),
  messages: z.array(AgentMessageSchema),
  tools_used: z.array(z.string()).optional(),
  files_touched: z.array(z.string()).optional(),
  tool_events: z.array(AgentToolEventSchema).optional(),
});

const MetadataSchema = z.object({
  webhookSecret: z
    .string()
    .optional()
    .describe('Optional shared secret expected in collector webhook payloads'),
});

const WebhookPayloadSchema = z
  .object({
    type: z.literal(WEBHOOK_TYPE),
    connectionId: z.string(),
    sentAt: z.string().optional(),
    secret: z.string().optional(),
    record: AgentConversationSchema.optional(),
    records: z.array(AgentConversationSchema).optional(),
  })
  .refine((payload) => payload.record || (payload.records && payload.records.length > 0), {
    message: 'Expected record or records',
  });

type AgentConversation = z.infer<typeof AgentConversationSchema>;
type Metadata = z.infer<typeof MetadataSchema>;
type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

const sync = createSync({
  description:
    'Sync Claude Code and Codex conversations captured by the local agent-capture collector as one record per session',
  version: '1.1.0',
  endpoints: [{ method: 'POST', path: '/syncs/agent-conversations', group: 'Agent Conversations' }],
  frequency: 'every hour',
  autoStart: false,
  webhookSubscriptions: [WEBHOOK_TYPE],
  metadata: MetadataSchema,

  models: {
    AgentConversation: AgentConversationSchema,
  },

  exec: async (nango) => {
    await nango.log('Agent conversation sync is webhook-only; the local collector pushes records.');
  },

  onWebhook: async (nango, rawPayload) => {
    const metadata = parseMetadata(await nango.getMetadata());
    const payload = WebhookPayloadSchema.parse(rawPayload);
    if (metadata.webhookSecret && payload.secret !== metadata.webhookSecret) {
      throw new Error('Invalid agent conversation webhook secret');
    }

    const records = recordsFromWebhookPayload(payload).sort(compareByUpdatedAt);
    const writer = new BatchWriter<AgentConversation>({
      nango,
      model: 'AgentConversation',
      batchSize: BATCH_SIZE,
      schema: AgentConversationSchema,
    });
    await writer.saveMany(records);
    await writer.flush();
    await nango.log(`Saved ${records.length} agent conversation webhook record(s)`);
  },
});

function compareByUpdatedAt(left: AgentConversation, right: AgentConversation): number {
  const byUpdatedAt = left.updated_at.localeCompare(right.updated_at);
  return byUpdatedAt === 0 ? left.id.localeCompare(right.id) : byUpdatedAt;
}

function recordsFromWebhookPayload(payload: WebhookPayload): AgentConversation[] {
  return payload.records ?? (payload.record ? [payload.record] : []);
}

function parseMetadata(value: unknown): Metadata {
  return MetadataSchema.parse(value ?? {});
}

export type NangoSyncLocal = Parameters<typeof sync.exec>[0];
export default sync;
