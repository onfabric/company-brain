import { Repository } from '#repositories/repository.ts';
import type { AgentConversationRecord, UsageFilters } from '#types.ts';

type NangoRecordDataRow = {
  data: unknown;
};

export abstract class UsageRepositoryContract {
  abstract listAgentConversations(filters: Pick<UsageFilters, 'from' | 'to'>): Promise<unknown[]>;
}

export class UsageRepository extends Repository implements UsageRepositoryContract {
  async listAgentConversations(filters: Pick<UsageFilters, 'from' | 'to'>): Promise<unknown[]> {
    const rows = await this.sql<NangoRecordDataRow[]>`
      SELECT rd.data
      FROM nango_records.records r
      JOIN nango_records.records_data rd
        ON rd.connection_id = r.connection_id
        AND rd.model = r.model
        AND rd.id = r.id
      WHERE r.model = 'AgentConversation'
        AND r.deleted_at IS NULL
        AND rd.data ? 'created_at'
        AND (rd.data->>'created_at')::timestamptz >= ${filters.from}
        AND (rd.data->>'created_at')::timestamptz < ${filters.to}
      ORDER BY (rd.data->>'created_at')::timestamptz DESC
    `;

    return rows.map((row) => row.data);
  }
}

export function parseAgentConversationRecord(value: unknown): AgentConversationRecord | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const id = asString(record.id);
  const source = asString(record.source);
  const sessionId = asString(record.session_id);
  const createdAt = asString(record.created_at);
  const updatedAt = asString(record.updated_at);
  const messages = asArray(record.messages);
  if (!id || !source || !sessionId || !createdAt || !updatedAt || !messages) {
    return undefined;
  }

  return {
    id,
    source,
    session_id: sessionId,
    user_identifier: asString(record.user_identifier),
    workspace: asString(record.workspace),
    repo: asString(record.repo),
    cwd: asString(record.cwd),
    title: asString(record.title),
    model: asString(record.model),
    created_at: createdAt,
    updated_at: updatedAt,
    ended_at: asString(record.ended_at),
    usage: asUsage(record.usage),
    messages: messages
      .map(asMessage)
      .filter((message): message is NonNullable<typeof message> => Boolean(message)),
    usage_events: asArray(record.usage_events)
      ?.map(asUsageEvent)
      .filter((event): event is NonNullable<typeof event> => Boolean(event)),
  };
}

function asMessage(value: unknown): AgentConversationRecord['messages'][number] | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    role: asString(record.role),
    text: asString(record.text),
    created_at: asString(record.created_at),
    model: asString(record.model),
    usage: asUsage(record.usage),
  };
}

function asUsageEvent(
  value: unknown,
): NonNullable<AgentConversationRecord['usage_events']>[number] | undefined {
  const record = asRecord(value);
  const usage = record ? asUsage(record.usage) : undefined;
  if (!record || !usage) {
    return undefined;
  }

  return {
    created_at: asString(record.created_at),
    model: asString(record.model),
    usage,
  };
}

function asUsage(value: unknown): AgentConversationRecord['usage'] {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    input_tokens: asNumber(record.input_tokens),
    output_tokens: asNumber(record.output_tokens),
    cache_creation_input_tokens: asNumber(record.cache_creation_input_tokens),
    cache_creation_5m_input_tokens: asNumber(record.cache_creation_5m_input_tokens),
    cache_creation_1h_input_tokens: asNumber(record.cache_creation_1h_input_tokens),
    cache_read_input_tokens: asNumber(record.cache_read_input_tokens),
    reasoning_output_tokens: asNumber(record.reasoning_output_tokens),
    total_tokens: asNumber(record.total_tokens),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
