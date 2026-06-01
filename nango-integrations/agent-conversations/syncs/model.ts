import { z } from 'zod';

import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';

export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  text: z.string(),
  created_at: z.string().optional(),
  tool_name: z.string().optional(),
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

export const AgentConversationSchema = defineCompanyBrainRecord({
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

export type AgentConversation = z.infer<typeof AgentConversationSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
export type AgentToolEvent = z.infer<typeof AgentToolEventSchema>;
