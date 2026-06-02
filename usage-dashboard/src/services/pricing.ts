// biome-ignore-all lint/style/noMagicNumbers: Model prices are data from provider pricing tables.

import type { AgentTokenUsage } from '#types.ts';

export type ModelPricing = {
  input: number;
  output: number;
  cachedInput?: number | undefined;
  cacheCreation?: number | undefined;
  cacheCreation5m?: number | undefined;
  cacheCreation1h?: number | undefined;
  inputIncludesCacheRead?: boolean | undefined;
};

type PricingConfig = Record<string, ModelPricing>;

const DEFAULT_PRICING: PricingConfig = {
  'codex-mini-latest': openAiPrice(1.5, 0.375, 6),
  'gpt-4.1': openAiPrice(2, 0.5, 8),
  'gpt-4.1-mini': openAiPrice(0.4, 0.1, 1.6),
  'gpt-4.1-nano': openAiPrice(0.1, 0.025, 0.4),
  'gpt-4o': openAiPrice(2.5, 1.25, 10),
  'gpt-4o-mini': openAiPrice(0.15, 0.075, 0.6),
  'gpt-5': openAiPrice(1.25, 0.125, 10),
  'gpt-5-chat-latest': openAiPrice(1.25, 0.125, 10),
  'gpt-5-codex': openAiPrice(1.25, 0.125, 10),
  'gpt-5-mini': openAiPrice(0.25, 0.025, 2),
  'gpt-5-nano': openAiPrice(0.05, 0.005, 0.4),
  'gpt-5.1': openAiPrice(1.25, 0.125, 10),
  'gpt-5.1-chat-latest': openAiPrice(1.25, 0.125, 10),
  'gpt-5.1-codex': openAiPrice(1.25, 0.125, 10),
  'gpt-5.1-codex-max': openAiPrice(1.25, 0.125, 10),
  'gpt-5.2': openAiPrice(1.75, 0.175, 14),
  'gpt-5.2-chat-latest': openAiPrice(1.75, 0.175, 14),
  'gpt-5.2-codex': openAiPrice(1.75, 0.175, 14),
  'gpt-5-pro': openAiPrice(15, undefined, 120),
  'gpt-5.2-pro': openAiPrice(21, undefined, 168),
  'claude-3-5-haiku': anthropicPrice(0.8, 1, 1.6, 0.08, 4),
  'claude-3-5-sonnet': anthropicPrice(3, 3.75, 6, 0.3, 15),
  'claude-3-7-sonnet': anthropicPrice(3, 3.75, 6, 0.3, 15),
  'claude-3-haiku': anthropicPrice(0.25, 0.3, 0.5, 0.03, 1.25),
  'claude-3-opus': anthropicPrice(15, 18.75, 30, 1.5, 75),
  'claude-opus-4': anthropicPrice(15, 18.75, 30, 1.5, 75),
  'claude-opus-4.1': anthropicPrice(15, 18.75, 30, 1.5, 75),
  'claude-sonnet-4': anthropicPrice(3, 3.75, 6, 0.3, 15),
};

export function loadPricing(raw = process.env.AI_USAGE_PRICING_JSON): PricingConfig {
  return {
    ...DEFAULT_PRICING,
    ...parsePricingOverride(raw),
  };
}

export function estimateCostUsd(
  usage: AgentTokenUsage | undefined,
  model: string | undefined,
  pricing: PricingConfig,
): number {
  if (!usage || !model) {
    return 0;
  }

  const price = pricingForModel(model, pricing);
  if (!price) {
    return 0;
  }

  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheCreation5mTokens = usage.cache_creation_5m_input_tokens ?? 0;
  const cacheCreation1hTokens = usage.cache_creation_1h_input_tokens ?? 0;
  const splitCacheCreationTokens = cacheCreation5mTokens + cacheCreation1hTokens;
  const cacheCreationTokens =
    usage.cache_creation_input_tokens !== undefined
      ? Math.max(usage.cache_creation_input_tokens - splitCacheCreationTokens, 0)
      : 0;
  const inputTokens = price.inputIncludesCacheRead
    ? Math.max((usage.input_tokens ?? 0) - cacheReadTokens, 0)
    : (usage.input_tokens ?? 0);
  const outputTokens =
    usage.output_tokens ??
    (usage.reasoning_output_tokens !== undefined ? usage.reasoning_output_tokens : 0);

  return roundCurrency(
    perMillion(inputTokens, price.input) +
      perMillion(outputTokens, price.output) +
      perMillion(cacheReadTokens, price.cachedInput ?? price.input) +
      perMillion(cacheCreationTokens, price.cacheCreation ?? price.input) +
      perMillion(
        cacheCreation5mTokens,
        price.cacheCreation5m ?? price.cacheCreation ?? price.input,
      ) +
      perMillion(
        cacheCreation1hTokens,
        price.cacheCreation1h ?? price.cacheCreation ?? price.input,
      ),
  );
}

function pricingForModel(model: string, pricing: PricingConfig): ModelPricing | undefined {
  const normalized = model.toLowerCase();
  const exact = pricing[normalized];
  if (exact) {
    return exact;
  }

  return Object.entries(pricing)
    .sort((left, right) => right[0].length - left[0].length)
    .find(([prefix]) => normalized.startsWith(prefix))?.[1];
}

function parsePricingOverride(raw: string | undefined): PricingConfig {
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI_USAGE_PRICING_JSON must be a JSON object');
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([model, value]) => [model.toLowerCase(), parseModelPricing(value)]),
  );
}

function parseModelPricing(value: unknown): ModelPricing {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI_USAGE_PRICING_JSON model entries must be objects');
  }

  const record = value as Record<string, unknown>;
  const input = parseNumber(record.input);
  const output = parseNumber(record.output);
  if (input === undefined || output === undefined) {
    throw new Error('AI_USAGE_PRICING_JSON model entries need input and output prices');
  }

  return {
    input,
    output,
    cachedInput: parseNumber(record.cachedInput),
    cacheCreation: parseNumber(record.cacheCreation),
    cacheCreation5m: parseNumber(record.cacheCreation5m),
    cacheCreation1h: parseNumber(record.cacheCreation1h),
    inputIncludesCacheRead: record.inputIncludesCacheRead === true,
  };
}

function parseNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function openAiPrice(input: number, cachedInput: number | undefined, output: number): ModelPricing {
  return {
    input,
    output,
    cachedInput,
    inputIncludesCacheRead: true,
  };
}

function anthropicPrice(
  input: number,
  cacheCreation5m: number,
  cacheCreation1h: number,
  cachedInput: number,
  output: number,
): ModelPricing {
  return {
    input,
    output,
    cachedInput,
    cacheCreation5m,
    cacheCreation1h,
  };
}

function perMillion(tokens: number, price: number): number {
  return (tokens / 1_000_000) * price;
}

function roundCurrency(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
