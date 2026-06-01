import type { AgentConversation, AgentMessage } from './types.js';

const EMPTY_LINE = '';

export function renderConversationBody(conversation: Omit<AgentConversation, 'body'>): string {
  const lines = [
    `# ${conversation.source}: ${conversation.title ?? 'Untitled agent conversation'}`,
    EMPTY_LINE,
    `- Source: ${conversation.source}`,
    `- Session: ${conversation.session_id}`,
  ];

  pushOptionalLine(lines, 'User', conversation.user_identifier);
  pushOptionalLine(lines, 'Workspace', conversation.workspace);
  pushOptionalLine(lines, 'Repository', conversation.repo);
  pushOptionalLine(lines, 'Working directory', conversation.cwd);
  lines.push(`- Started: ${conversation.started_at}`);
  lines.push(`- Updated: ${conversation.updated_at}`);
  pushOptionalLine(lines, 'Ended', conversation.ended_at);
  pushList(lines, 'Tools used', conversation.tools_used);
  pushList(lines, 'Files touched', conversation.files_touched);
  lines.push(EMPTY_LINE);

  for (const message of conversation.messages) {
    lines.push(renderMessageHeading(message));
    lines.push(EMPTY_LINE);
    lines.push(message.text);
    if (message.files && message.files.length > 0) {
      lines.push(EMPTY_LINE);
      lines.push(`Files: ${message.files.join(', ')}`);
    }
    lines.push(EMPTY_LINE);
  }

  return lines.join('\n').trim();
}

function renderMessageHeading(message: AgentMessage): string {
  const role = message.tool_name ? `${message.role}: ${message.tool_name}` : message.role;
  return message.created_at ? `## ${message.created_at} - ${role}` : `## ${role}`;
}

function pushOptionalLine(lines: string[], label: string, value: string | undefined): void {
  if (value) {
    lines.push(`- ${label}: ${value}`);
  }
}

function pushList(lines: string[], label: string, values: string[] | undefined): void {
  if (values && values.length > 0) {
    lines.push(`- ${label}: ${values.join(', ')}`);
  }
}
