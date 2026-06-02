// biome-ignore-all lint/style/noMagicNumbers: Price tests are compact arithmetic fixtures.

import { describe, expect, it } from 'bun:test';

import { estimateCostUsd, loadPricing } from '../src/services/pricing.ts';

describe('pricing', () => {
  it('estimates OpenAI cached input with the cached-input rate', () => {
    const cost = estimateCostUsd(
      {
        input_tokens: 1_000,
        cache_read_input_tokens: 200,
        output_tokens: 100,
        total_tokens: 1_100,
      },
      'gpt-5-codex',
      loadPricing(),
    );

    expect(cost).toBe(0.002025);
  });

  it('estimates Anthropic cache writes and reads with separate rates', () => {
    const cost = estimateCostUsd(
      {
        input_tokens: 10,
        cache_creation_5m_input_tokens: 30,
        cache_read_input_tokens: 40,
        output_tokens: 20,
      },
      'claude-sonnet-4-20250514',
      loadPricing(),
    );

    expect(cost).toBe(0.000455);
  });

  it('lets deployments override model pricing from JSON', () => {
    const pricing = loadPricing(
      '{"custom-model":{"input":2,"output":4,"cachedInput":1,"inputIncludesCacheRead":true}}',
    );
    const cost = estimateCostUsd(
      {
        input_tokens: 1_000,
        cache_read_input_tokens: 100,
        output_tokens: 100,
      },
      'custom-model',
      pricing,
    );

    expect(cost).toBe(0.0023);
  });
});
