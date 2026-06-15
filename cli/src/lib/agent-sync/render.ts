import type { AgentConversation, AgentMessage } from './types.ts';

const EMPTY_LINE = '';

export function renderConversationBody(conversation: Omit<AgentConversation, 'body'>): string {
  const lines = [`# ${renderSourceName(conversation.source)} conversation`, EMPTY_LINE];

  lines.push(`- Session: ${conversation.session_id}`);
  pushOptionalLine(lines, 'User', conversation.user_identifier);
  pushOptionalLine(lines, 'Workspace', conversation.workspace);
  pushOptionalLine(lines, 'Repository', conversation.repo);
  pushOptionalLine(lines, 'Model', conversation.model);
  lines.push(`- Started: ${conversation.started_at}`);
  lines.push(`- Updated: ${conversation.updated_at}`);
  pushOptionalLine(lines, 'Ended', conversation.ended_at);
  if (conversation.usage?.total_tokens !== undefined) {
    lines.push(`- Total tokens: ${conversation.usage.total_tokens}`);
  }
  lines.push(EMPTY_LINE);

  for (const message of conversation.messages) {
    if (message.role !== 'user' && message.role !== 'assistant') {
      continue;
    }

    lines.push(renderMessageHeading(message));
    lines.push(EMPTY_LINE);
    lines.push(message.text);
    lines.push(EMPTY_LINE);
  }

  return lines.join('\n').trim();
}

function renderMessageHeading(message: AgentMessage): string {
  const role = message.role === 'user' ? 'User prompt' : 'Assistant response';
  return message.created_at ? `## ${role} - ${message.created_at}` : `## ${role}`;
}

function renderSourceName(source: AgentConversation['source']): string {
  return source === 'claude-code' ? 'Claude Code' : 'Codex';
}

function pushOptionalLine(lines: string[], label: string, value: string | undefined): void {
  if (value) {
    lines.push(`- ${label}: ${value}`);
  }
}
