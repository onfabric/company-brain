import { createSync } from 'nango';
import { z } from 'zod';

import { BatchWriter } from '../../syncs/batch-writer.js';
import { createBrainSink } from '../../syncs/brain-sink.js';
import { type AgentConversation, AgentConversationSchema } from './model.js';
import { renderConversationBody } from './render.js';

const BATCH_SIZE = 50;
const WEBHOOK_TYPE = 'agent.conversation.upsert';

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
    const payload = WebhookPayloadSchema.parse(normalizeRawPayload(rawPayload));
    if (metadata.webhookSecret && payload.secret !== metadata.webhookSecret) {
      throw new Error('Invalid agent conversation webhook secret');
    }

    const records = recordsFromWebhookPayload(payload)
      .map(withRenderedBody)
      .sort(compareByUpdatedAt);
    const writer = new BatchWriter<AgentConversation>({
      nango,
      model: 'AgentConversation',
      batchSize: BATCH_SIZE,
      schema: AgentConversationSchema,
      afterSave: createBrainSink(nango),
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

// The collector emits a conversation's start time as `started_at`; the Company
// Brain record contract names that canonical timestamp `created_at`. Map it at the
// webhook boundary so the saved record matches the shared contract.
function normalizeRawPayload(rawPayload: unknown): unknown {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return rawPayload;
  }

  const { record, records, ...rest } = rawPayload as {
    record?: unknown;
    records?: unknown;
    [key: string]: unknown;
  };
  return {
    ...rest,
    ...(record !== undefined ? { record: normalizeRecord(record) } : {}),
    ...(Array.isArray(records) ? { records: records.map(normalizeRecord) } : {}),
  };
}

function normalizeRecord(record: unknown): unknown {
  if (!record || typeof record !== 'object' || !('started_at' in record)) {
    return record;
  }

  const { started_at, ...rest } = record as Record<string, unknown>;
  return { created_at: started_at, ...rest };
}

function withRenderedBody(record: AgentConversation): AgentConversation {
  return {
    ...record,
    body: renderConversationBody(record),
  };
}

function parseMetadata(value: unknown): Metadata {
  return MetadataSchema.parse(value ?? {});
}

export type NangoSyncLocal = Parameters<typeof sync.exec>[0];
export default sync;
