import { z } from 'zod';

import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';

export const AgentTokenUsageSchema = z.object({
  input_tokens: z.number().nonnegative().optional(),
  output_tokens: z.number().nonnegative().optional(),
  cache_creation_input_tokens: z.number().nonnegative().optional(),
  cache_creation_5m_input_tokens: z.number().nonnegative().optional(),
  cache_creation_1h_input_tokens: z.number().nonnegative().optional(),
  cache_read_input_tokens: z.number().nonnegative().optional(),
  reasoning_output_tokens: z.number().nonnegative().optional(),
  total_tokens: z.number().nonnegative().optional(),
});

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  text: z.string(),
  created_at: z.string().optional(),
  tool_name: z.string().optional(),
  model: z.string().optional(),
  usage: AgentTokenUsageSchema.optional(),
  files: z.array(z.string()).optional(),
});

export const AgentToolEventSchema = z.object({
  name: z.string(),
  created_at: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
  status: z.enum(['started', 'completed', 'failed']).optional(),
  files: z.array(z.string()).optional(),
});

export const AgentUsageEventSchema = z.object({
  created_at: z.string().optional(),
  model: z.string().optional(),
  usage: AgentTokenUsageSchema,
});

export const AgentConversationSchema = defineCompanyBrainRecord({
  source: z.enum(['claude-code', 'codex']),
  session_id: z.string(),
  user_identifier: z.string().optional(),
  workspace: z.string().optional(),
  repo: z.string().optional(),
  cwd: z.string().optional(),
  title: z.string().optional(),
  model: z.string().optional(),
  ended_at: z.string().optional(),
  usage: AgentTokenUsageSchema.optional(),
  messages: z.array(AgentMessageSchema),
  usage_events: z.array(AgentUsageEventSchema).optional(),
  tools_used: z.array(z.string()).optional(),
  files_touched: z.array(z.string()).optional(),
  tool_events: z.array(AgentToolEventSchema).optional(),
});

export type AgentConversation = z.infer<typeof AgentConversationSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type AgentTokenUsage = z.infer<typeof AgentTokenUsageSchema>;
export type AgentToolEvent = z.infer<typeof AgentToolEventSchema>;
export type AgentUsageEvent = z.infer<typeof AgentUsageEventSchema>;
