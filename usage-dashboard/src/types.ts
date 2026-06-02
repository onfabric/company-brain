export type AgentTokenUsage = {
  input_tokens?: number | undefined;
  output_tokens?: number | undefined;
  cache_creation_input_tokens?: number | undefined;
  cache_creation_5m_input_tokens?: number | undefined;
  cache_creation_1h_input_tokens?: number | undefined;
  cache_read_input_tokens?: number | undefined;
  reasoning_output_tokens?: number | undefined;
  total_tokens?: number | undefined;
};

export type AgentMessage = {
  role?: string | undefined;
  text?: string | undefined;
  created_at?: string | undefined;
  model?: string | undefined;
  usage?: AgentTokenUsage | undefined;
};

export type AgentUsageEvent = {
  created_at?: string | undefined;
  model?: string | undefined;
  usage?: AgentTokenUsage | undefined;
};

export type AgentConversationRecord = {
  id: string;
  source: string;
  session_id: string;
  user_identifier?: string | undefined;
  workspace?: string | undefined;
  repo?: string | undefined;
  cwd?: string | undefined;
  title?: string | undefined;
  model?: string | undefined;
  created_at: string;
  updated_at: string;
  ended_at?: string | undefined;
  usage?: AgentTokenUsage | undefined;
  messages: AgentMessage[];
  usage_events?: AgentUsageEvent[] | undefined;
};

export type UsageDimension = 'day' | 'model' | 'session' | 'source' | 'user';

export type UsageFilters = {
  from: Date;
  to: Date;
  user?: string | undefined;
  source?: string | undefined;
  model?: string | undefined;
  dimension: UsageDimension;
};

export type UsageTotals = AgentTokenUsage & {
  sessions: number;
  messages: number;
  cost_usd: number;
  estimated_sessions: number;
};

export type UsageBucket = UsageTotals & {
  key: string;
  label: string;
};

export type SessionUsage = UsageTotals & {
  id: string;
  source: string;
  session_id: string;
  user: string;
  model: string;
  title?: string | undefined;
  started_at: string;
  updated_at: string;
};

export type UsageDashboard = {
  generated_at: string;
  range: {
    from: string;
    to: string;
  };
  selected: {
    dimension: UsageDimension;
    user?: string | undefined;
    source?: string | undefined;
    model?: string | undefined;
  };
  filters: {
    users: string[];
    sources: string[];
    models: string[];
  };
  totals: UsageTotals;
  timeseries: UsageBucket[];
  breakdown: UsageBucket[];
  sessions: SessionUsage[];
};
