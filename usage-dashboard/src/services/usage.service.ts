import {
  parseAgentConversationRecord,
  type UsageRepositoryContract,
} from '#repositories/usage.repository.ts';
import { estimateCostUsd, type ModelPricing } from '#services/pricing.ts';
import { Service } from '#services/service.ts';
import type {
  AgentConversationRecord,
  AgentTokenUsage,
  SessionUsage,
  UsageBucket,
  UsageDashboard,
  UsageDimension,
  UsageFilters,
  UsageTotals,
} from '#types.ts';

const UNKNOWN_MODEL = 'Unknown model';
const UNKNOWN_USER = 'Unknown user';
const RECENT_SESSION_LIMIT = 100;
const CURRENCY_PRECISION = 1_000_000;

export class UsageService extends Service {
  private readonly usageRepo: UsageRepositoryContract;
  private readonly pricing: Record<string, ModelPricing>;

  constructor(usageRepo: UsageRepositoryContract, pricing: Record<string, ModelPricing>) {
    super();
    this.usageRepo = usageRepo;
    this.pricing = pricing;
  }

  async dashboard(filters: UsageFilters): Promise<UsageDashboard> {
    const records = (await this.usageRepo.listAgentConversations(filters))
      .map(parseAgentConversationRecord)
      .filter((record): record is AgentConversationRecord => Boolean(record));
    const ranged = records
      .map((record) => this.toSessionUsage(record))
      .filter((session): session is SessionUsage => Boolean(session));
    const filtered = ranged.filter((session) => matchesFilters(session, filters));

    this.logger.info(`loaded ${filtered.length}/${ranged.length} usage session(s)`);

    return {
      generated_at: new Date().toISOString(),
      range: {
        from: filters.from.toISOString(),
        to: filters.to.toISOString(),
      },
      selected: {
        dimension: filters.dimension,
        user: filters.user,
        source: filters.source,
        model: filters.model,
      },
      filters: {
        users: distinctSorted(ranged.map((session) => session.user)),
        sources: distinctSorted(ranged.map((session) => session.source)),
        models: distinctSorted(ranged.map((session) => session.model)),
      },
      totals: totalSessions(filtered),
      timeseries: groupSessions(filtered, 'day'),
      breakdown: groupSessions(filtered, filters.dimension),
      sessions: filtered.sort(compareSessions).slice(0, RECENT_SESSION_LIMIT),
    };
  }

  private toSessionUsage(record: AgentConversationRecord): SessionUsage | undefined {
    const startedAt = parseDate(record.created_at);
    const updatedAt = parseDate(record.updated_at);
    if (!startedAt || !updatedAt) {
      return undefined;
    }

    const model = conversationModel(record);
    const usage =
      compactUsage(record.usage) ??
      sumUsage(record.usage_events?.map((event) => event.usage).filter(isUsage) ?? []) ??
      sumUsage(record.messages.map((message) => message.usage).filter(isUsage));
    const costUsd = estimateCostUsd(usage, model, this.pricing);

    return {
      id: record.id,
      source: record.source,
      session_id: record.session_id,
      user: record.user_identifier ?? UNKNOWN_USER,
      model,
      title: record.title,
      started_at: startedAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      sessions: 1,
      messages: record.messages.length,
      cost_usd: costUsd,
      estimated_sessions: costUsd > 0 ? 1 : 0,
      ...usage,
    };
  }
}

function matchesFilters(session: SessionUsage, filters: UsageFilters): boolean {
  return (
    (!filters.user || session.user === filters.user) &&
    (!filters.source || session.source === filters.source) &&
    (!filters.model || session.model === filters.model)
  );
}

function groupSessions(sessions: SessionUsage[], dimension: UsageDimension): UsageBucket[] {
  const buckets = new Map<string, UsageBucket>();
  for (const session of sessions) {
    const key = dimensionKey(session, dimension);
    const existing = buckets.get(key.key) ?? {
      key: key.key,
      label: key.label,
      ...emptyTotals(),
    };
    buckets.set(key.key, addTotals(existing, session));
  }

  return [...buckets.values()].sort((left, right) => compareBuckets(left, right, dimension));
}

function totalSessions(sessions: SessionUsage[]): UsageTotals {
  return sessions.reduce<UsageTotals>((total, session) => addTotals(total, session), emptyTotals());
}

function dimensionKey(
  session: SessionUsage,
  dimension: UsageDimension,
): Pick<UsageBucket, 'key' | 'label'> {
  if (dimension === 'day') {
    const day = session.started_at.slice(0, 10);
    return { key: day, label: day };
  }

  if (dimension === 'model') {
    return { key: session.model, label: session.model };
  }

  if (dimension === 'source') {
    return { key: session.source, label: sourceLabel(session.source) };
  }

  if (dimension === 'session') {
    return { key: session.id, label: session.title ?? session.session_id };
  }

  return { key: session.user, label: session.user };
}

function conversationModel(record: AgentConversationRecord): string {
  return (
    record.model ??
    record.usage_events?.find((event) => event.model)?.model ??
    record.messages.find((message) => message.model)?.model ??
    UNKNOWN_MODEL
  );
}

function compareBuckets(left: UsageBucket, right: UsageBucket, dimension: UsageDimension): number {
  if (dimension === 'day') {
    return left.key.localeCompare(right.key);
  }

  return right.cost_usd - left.cost_usd || (right.total_tokens ?? 0) - (left.total_tokens ?? 0);
}

function compareSessions(left: SessionUsage, right: SessionUsage): number {
  return right.updated_at.localeCompare(left.updated_at);
}

function sourceLabel(source: string): string {
  return source === 'claude-code' ? 'Claude Code' : source === 'codex' ? 'Codex' : source;
}

function distinctSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function emptyTotals(): UsageTotals {
  return {
    sessions: 0,
    messages: 0,
    cost_usd: 0,
    estimated_sessions: 0,
  };
}

function addTotals<T extends UsageTotals>(total: T, session: UsageTotals): T {
  return {
    ...total,
    sessions: total.sessions + session.sessions,
    messages: total.messages + session.messages,
    cost_usd: roundCurrency(total.cost_usd + session.cost_usd),
    estimated_sessions: total.estimated_sessions + session.estimated_sessions,
    input_tokens: add(total.input_tokens, session.input_tokens),
    output_tokens: add(total.output_tokens, session.output_tokens),
    cache_creation_input_tokens: add(
      total.cache_creation_input_tokens,
      session.cache_creation_input_tokens,
    ),
    cache_creation_5m_input_tokens: add(
      total.cache_creation_5m_input_tokens,
      session.cache_creation_5m_input_tokens,
    ),
    cache_creation_1h_input_tokens: add(
      total.cache_creation_1h_input_tokens,
      session.cache_creation_1h_input_tokens,
    ),
    cache_read_input_tokens: add(total.cache_read_input_tokens, session.cache_read_input_tokens),
    reasoning_output_tokens: add(total.reasoning_output_tokens, session.reasoning_output_tokens),
    total_tokens: add(total.total_tokens, session.total_tokens),
  };
}

function compactUsage(usage: AgentTokenUsage | undefined): AgentTokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  const entries = Object.entries(usage).filter(
    (entry): entry is [keyof AgentTokenUsage, number] => {
      const [, value] = entry;
      return value !== undefined;
    },
  );
  if (entries.length === 0) {
    return undefined;
  }

  return withTotalTokens(Object.fromEntries(entries) as AgentTokenUsage);
}

function sumUsage(usages: AgentTokenUsage[]): AgentTokenUsage | undefined {
  return compactUsage(
    usages.reduce<AgentTokenUsage>(
      (total, usage) => ({
        input_tokens: add(total.input_tokens, usage.input_tokens),
        output_tokens: add(total.output_tokens, usage.output_tokens),
        cache_creation_input_tokens: add(
          total.cache_creation_input_tokens,
          usage.cache_creation_input_tokens,
        ),
        cache_creation_5m_input_tokens: add(
          total.cache_creation_5m_input_tokens,
          usage.cache_creation_5m_input_tokens,
        ),
        cache_creation_1h_input_tokens: add(
          total.cache_creation_1h_input_tokens,
          usage.cache_creation_1h_input_tokens,
        ),
        cache_read_input_tokens: add(total.cache_read_input_tokens, usage.cache_read_input_tokens),
        reasoning_output_tokens: add(total.reasoning_output_tokens, usage.reasoning_output_tokens),
        total_tokens: add(total.total_tokens, usage.total_tokens),
      }),
      {},
    ),
  );
}

function withTotalTokens(usage: AgentTokenUsage): AgentTokenUsage {
  if (usage.total_tokens !== undefined) {
    return usage;
  }

  const cacheCreationTokens =
    usage.cache_creation_input_tokens ??
    (usage.cache_creation_5m_input_tokens ?? 0) + (usage.cache_creation_1h_input_tokens ?? 0);
  const totalTokens =
    (usage.input_tokens ?? 0) +
    (usage.output_tokens ?? 0) +
    cacheCreationTokens +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.reasoning_output_tokens ?? 0);

  return totalTokens > 0 ? { ...usage, total_tokens: totalTokens } : usage;
}

function add(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }
  return (left ?? 0) + (right ?? 0);
}

function isUsage(value: AgentTokenUsage | undefined): value is AgentTokenUsage {
  return Boolean(compactUsage(value));
}

function parseDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

function roundCurrency(value: number): number {
  return Math.round(value * CURRENCY_PRECISION) / CURRENCY_PRECISION;
}
