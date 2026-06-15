export const AGENT_SOURCES = ['claude-code', 'codex'] as const;

export type AgentSource = (typeof AGENT_SOURCES)[number];

export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AgentTokenUsage {
  input_tokens?: number | undefined;
  output_tokens?: number | undefined;
  cache_creation_input_tokens?: number | undefined;
  cache_creation_5m_input_tokens?: number | undefined;
  cache_creation_1h_input_tokens?: number | undefined;
  cache_read_input_tokens?: number | undefined;
  reasoning_output_tokens?: number | undefined;
  total_tokens?: number | undefined;
}

export interface AgentMessage {
  role: AgentMessageRole;
  text: string;
  created_at?: string | undefined;
  tool_name?: string | undefined;
  model?: string | undefined;
  usage?: AgentTokenUsage | undefined;
  files?: string[] | undefined;
}

export interface AgentToolEvent {
  name: string;
  created_at?: string | undefined;
  input?: string | undefined;
  output?: string | undefined;
  status?: 'started' | 'completed' | 'failed' | undefined;
  files?: string[] | undefined;
}

export interface AgentUsageEvent {
  created_at?: string | undefined;
  model?: string | undefined;
  usage: AgentTokenUsage;
}

export interface AgentConversation {
  id: string;
  body: string;
  source: AgentSource;
  session_id: string;
  user_identifier?: string | undefined;
  workspace?: string | undefined;
  repo?: string | undefined;
  cwd?: string | undefined;
  title?: string | undefined;
  model?: string | undefined;
  started_at: string;
  updated_at: string;
  ended_at?: string | undefined;
  usage?: AgentTokenUsage | undefined;
  messages: AgentMessage[];
  usage_events?: AgentUsageEvent[] | undefined;
  tools_used?: string[] | undefined;
  files_touched?: string[] | undefined;
  tool_events?: AgentToolEvent[] | undefined;
}

export interface TranscriptParseResult {
  session_id?: string | undefined;
  cwd?: string | undefined;
  model?: string | undefined;
  started_at?: string | undefined;
  updated_at?: string | undefined;
  usage?: AgentTokenUsage | undefined;
  messages: AgentMessage[];
  usage_events: AgentUsageEvent[];
  tool_events: AgentToolEvent[];
  tools_used: string[];
  files_touched: string[];
}
