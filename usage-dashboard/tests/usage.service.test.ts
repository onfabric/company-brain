// biome-ignore-all lint/style/noMagicNumbers: Usage tests are compact token-count fixtures.

import { describe, expect, it } from 'bun:test';

import { UsageRepositoryContract } from '../src/repositories/usage.repository.ts';
import { loadPricing } from '../src/services/pricing.ts';
import { UsageService } from '../src/services/usage.service.ts';
import type { UsageFilters } from '../src/types.ts';

class MockUsageRepository extends UsageRepositoryContract {
  constructor(private readonly records: unknown[]) {
    super();
  }

  listAgentConversations(): Promise<unknown[]> {
    return Promise.resolve(this.records);
  }
}

describe('UsageService', () => {
  it('aggregates sessions by user and emits daily usage', async () => {
    const service = new UsageService(
      new MockUsageRepository([codexRecord(), claudeRecord()]),
      loadPricing(),
    );
    const dashboard = await service.dashboard(filters('user'));

    expect(dashboard.totals.sessions).toBe(2);
    expect(dashboard.totals.messages).toBe(3);
    expect(dashboard.totals.total_tokens).toBe(1_200);
    expect(dashboard.breakdown.map((row) => row.key).sort()).toEqual(['ada', 'massimo']);
    expect(dashboard.timeseries.map((row) => row.key)).toEqual(['2026-06-01', '2026-06-02']);
  });

  it('supports session-level breakdowns', async () => {
    const service = new UsageService(
      new MockUsageRepository([codexRecord(), claudeRecord()]),
      loadPricing(),
    );
    const dashboard = await service.dashboard(filters('session'));

    expect(dashboard.breakdown).toHaveLength(2);
    expect(dashboard.breakdown[0]?.label).toBe('Codex session');
  });
});

function filters(dimension: UsageFilters['dimension']): UsageFilters {
  return {
    from: new Date('2026-06-01T00:00:00.000Z'),
    to: new Date('2026-06-03T00:00:00.000Z'),
    dimension,
  };
}

function codexRecord(): unknown {
  return {
    id: 'codex:one',
    source: 'codex',
    session_id: 'one',
    user_identifier: 'massimo',
    title: 'Codex session',
    model: 'gpt-5-codex',
    created_at: '2026-06-01T10:00:00.000Z',
    updated_at: '2026-06-01T10:05:00.000Z',
    usage: {
      input_tokens: 1_000,
      cache_read_input_tokens: 200,
      output_tokens: 100,
      total_tokens: 1_100,
    },
    messages: [
      { role: 'user', text: 'start' },
      { role: 'assistant', text: 'done' },
    ],
  };
}

function claudeRecord(): unknown {
  return {
    id: 'claude-code:two',
    source: 'claude-code',
    session_id: 'two',
    user_identifier: 'ada',
    title: 'Claude session',
    created_at: '2026-06-02T11:00:00.000Z',
    updated_at: '2026-06-02T11:05:00.000Z',
    messages: [{ role: 'assistant', text: 'done' }],
    usage_events: [
      {
        model: 'claude-sonnet-4-20250514',
        usage: {
          input_tokens: 10,
          cache_creation_5m_input_tokens: 30,
          cache_read_input_tokens: 40,
          output_tokens: 20,
          total_tokens: 100,
        },
      },
    ],
  };
}
