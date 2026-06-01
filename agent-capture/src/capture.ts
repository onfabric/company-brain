import { getUserIdentifier, isEventLogEnabled } from './config.js';
import { renderConversationBody } from './render.js';
import type { AgentCaptureStore } from './store.js';
import { parseTranscriptFile } from './transcript-parser.js';
import type { AgentConversation, AgentMessage, AgentSource, HookEventEnvelope } from './types.js';
import {
  collectPathValues,
  nowIso,
  repoNameFromCwd,
  titleFromText,
  toIso,
  uniqueStrings,
  workspaceNameFromCwd,
} from './utils.js';

const SESSION_FALLBACK_PREFIX = 'unknown-session';

export async function captureHookEvent(
  store: AgentCaptureStore,
  envelope: HookEventEnvelope,
): Promise<AgentConversation> {
  if (isEventLogEnabled()) {
    await store.appendEvent(envelope);
  }

  const event = envelope.event;
  const sessionId =
    readString(event, 'session_id') ??
    readString(event, 'sessionId') ??
    fallbackSessionId(envelope);
  const transcript = await parseTranscriptFile(
    readString(event, 'transcript_path'),
    envelope.source,
  );
  const fallbackMessages = messagesFromHookEvent(envelope);
  const messages = mergeMessages(
    transcript.messages.length > 0 ? transcript.messages : undefined,
    fallbackMessages,
  );
  const cwd = transcript.cwd ?? readString(event, 'cwd');
  const startedAt =
    transcript.started_at ?? toIso(readString(event, 'timestamp')) ?? envelope.received_at;
  const updatedAt =
    transcript.updated_at ?? toIso(readString(event, 'timestamp')) ?? envelope.received_at;
  const endedAt = isSessionEndEvent(event)
    ? (toIso(readString(event, 'timestamp')) ?? envelope.received_at)
    : undefined;
  const toolsUsed = uniqueStrings(transcript.tools_used);
  const filesTouched = uniqueStrings([...transcript.files_touched, ...collectPathValues(event)]);
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const title = firstUserMessage ? titleFromText(firstUserMessage.text) : undefined;

  const withoutBody: Omit<AgentConversation, 'body'> = removeUndefined({
    id: conversationId(envelope.source, sessionId),
    source: envelope.source,
    session_id: sessionId,
    user_identifier: getUserIdentifier(),
    workspace: workspaceNameFromCwd(cwd),
    repo: repoNameFromCwd(cwd),
    cwd,
    title,
    started_at: startedAt,
    updated_at: updatedAt,
    ended_at: endedAt,
    messages,
    tools_used: toolsUsed.length > 0 ? toolsUsed : undefined,
    files_touched: filesTouched.length > 0 ? filesTouched : undefined,
    tool_events: transcript.tool_events.length > 0 ? transcript.tool_events : undefined,
  });
  const conversation = {
    ...withoutBody,
    body: renderConversationBody(withoutBody),
  };

  return conversation;
}

export async function captureTranscriptFile(
  source: AgentSource,
  transcriptPath: string,
): Promise<AgentConversation | undefined> {
  const transcript = await parseTranscriptFile(transcriptPath, source);
  if (transcript.messages.length === 0) {
    return undefined;
  }

  const sessionId = transcript.session_id ?? fallbackSessionId(makeHookEnvelope(source, {}));
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
    user_identifier: getUserIdentifier(),
    workspace: workspaceNameFromCwd(cwd),
    repo: repoNameFromCwd(cwd),
    cwd,
    title,
    started_at: startedAt,
    updated_at: updatedAt,
    messages,
    tools_used: toolsUsed.length > 0 ? toolsUsed : undefined,
    files_touched: filesTouched.length > 0 ? filesTouched : undefined,
    tool_events: transcript.tool_events.length > 0 ? transcript.tool_events : undefined,
  });
  const conversation = {
    ...withoutBody,
    body: renderConversationBody(withoutBody),
  };

  return conversation;
}

export function makeHookEnvelope(
  source: AgentSource,
  event: Record<string, unknown>,
): HookEventEnvelope {
  return {
    source,
    received_at: nowIso(),
    event,
  };
}

export function conversationId(source: AgentSource, sessionId: string): string {
  return `${source}:${sessionId}`;
}

function messagesFromHookEvent(envelope: HookEventEnvelope): AgentMessage[] {
  const eventName = readString(envelope.event, 'hook_event_name');
  const createdAt = toIso(readString(envelope.event, 'timestamp')) ?? envelope.received_at;
  const messages: AgentMessage[] = [];

  if (eventName === 'UserPromptSubmit') {
    const prompt = readString(envelope.event, 'prompt');
    if (prompt) {
      messages.push({ role: 'user', text: prompt, created_at: createdAt });
    }
  }

  if (eventName === 'Stop' || eventName === 'StopFailure' || eventName === 'SubagentStop') {
    const text = readString(envelope.event, 'last_assistant_message');
    if (text) {
      messages.push({ role: 'assistant', text, created_at: createdAt });
    }
  }

  return messages;
}

function mergeMessages(
  primary: readonly AgentMessage[] | undefined,
  fallback: readonly AgentMessage[],
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (const message of [...(primary ?? []), ...fallback]) {
    const exists = messages.some(
      (existing) =>
        existing.role === message.role &&
        existing.tool_name === message.tool_name &&
        existing.text === message.text,
    );
    if (!exists) {
      messages.push(message);
    }
  }
  return messages;
}

function isSessionEndEvent(event: Record<string, unknown>): boolean {
  const eventName = readString(event, 'hook_event_name');
  return eventName === 'SessionEnd';
}

function fallbackSessionId(envelope: HookEventEnvelope): string {
  return `${SESSION_FALLBACK_PREFIX}-${envelope.received_at}`;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Exclude<unknown, undefined>] => {
      const [, entryValue] = entry;
      return entryValue !== undefined;
    }),
  ) as T;
}
