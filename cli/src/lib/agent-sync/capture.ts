import { renderConversationBody } from './render.ts';
import { parseTranscriptFile } from './transcript-parser.ts';
import type { AgentConversation, AgentSource } from './types.ts';
import {
  nowIso,
  repoNameFromCwd,
  stableHash,
  titleFromText,
  uniqueStrings,
  workspaceNameFromCwd,
} from './utils.ts';

const SESSION_FALLBACK_PREFIX = 'unknown-session';
const FALLBACK_SESSION_HASH_LENGTH = 16;

export async function captureTranscriptFile(
  source: AgentSource,
  transcriptPath: string,
  userIdentifier: string,
): Promise<AgentConversation | undefined> {
  const transcript = await parseTranscriptFile(transcriptPath, source);
  if (transcript.messages.length === 0) {
    return undefined;
  }

  const sessionId = transcript.session_id ?? fallbackSessionId(transcriptPath);
  const cwd = transcript.cwd;
  const messages = transcript.messages;
  const startedAt = transcript.started_at ?? nowIso();
  const updatedAt = transcript.updated_at ?? startedAt;
  const toolsUsed = uniqueStrings(transcript.tools_used);
  const filesTouched = uniqueStrings([...transcript.files_touched, transcriptPath]);
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const title = firstUserMessage ? titleFromText(firstUserMessage.text) : undefined;

  const withoutBody: Omit<AgentConversation, 'body'> = removeUndefined({
    id: conversationId(source, sessionId),
    source,
    session_id: sessionId,
    user_identifier: userIdentifier,
    workspace: workspaceNameFromCwd(cwd),
    repo: repoNameFromCwd(cwd),
    cwd,
    title,
    model: transcript.model,
    started_at: startedAt,
    updated_at: updatedAt,
    usage: transcript.usage,
    messages,
    usage_events: transcript.usage_events.length > 0 ? transcript.usage_events : undefined,
    tools_used: toolsUsed.length > 0 ? toolsUsed : undefined,
    files_touched: filesTouched.length > 0 ? filesTouched : undefined,
    tool_events: transcript.tool_events.length > 0 ? transcript.tool_events : undefined,
  });

  return {
    ...withoutBody,
    body: renderConversationBody(withoutBody),
  };
}

export function conversationId(source: AgentSource, sessionId: string): string {
  return `${source}:${sessionId}`;
}

function fallbackSessionId(transcriptPath: string): string {
  return `${SESSION_FALLBACK_PREFIX}-${stableHash(transcriptPath).slice(0, FALLBACK_SESSION_HASH_LENGTH)}`;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Exclude<unknown, undefined>] => {
      const [, entryValue] = entry;
      return entryValue !== undefined;
    }),
  ) as T;
}
