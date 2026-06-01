import fs from 'node:fs';

import type {
  AgentMessage,
  AgentMessageRole,
  AgentSource,
  AgentToolEvent,
  TranscriptParseResult,
} from './types.js';
import {
  collectPathValues,
  compactText,
  earlierIso,
  laterIso,
  stringifyCompact,
  toIso,
  uniqueStrings,
} from './utils.js';

const CODEX_MESSAGE_EVENT_TYPES = new Set(['user_message', 'agent_message']);
const CODEX_MESSAGE_PAYLOAD_TYPE = 'message';
const CLAUDE_USER_TYPE = 'user';
const CLAUDE_ASSISTANT_TYPE = 'assistant';
const TOOL_STARTED_STATUS = 'started';
const TOOL_COMPLETED_STATUS = 'completed';

interface ParserState extends TranscriptParseResult {
  callNames: Map<string, string>;
}

export async function parseTranscriptFile(
  filePath: string | undefined,
  source: AgentSource,
): Promise<TranscriptParseResult> {
  const empty = createState();
  if (!filePath || !fs.existsSync(filePath)) {
    return finalize(empty);
  }

  const content = await fs.promises.readFile(filePath, 'utf8');
  const state = createState();
  for (const line of content.split('\n')) {
    const record = parseJsonLine(line);
    if (!record) {
      continue;
    }

    if (source === 'codex') {
      readCodexRecord(record, state);
    } else {
      readClaudeRecord(record, state);
    }
  }

  return finalize(state);
}

function createState(): ParserState {
  return {
    messages: [],
    tool_events: [],
    tools_used: [],
    files_touched: [],
    callNames: new Map(),
  };
}

function finalize(state: ParserState): TranscriptParseResult {
  return {
    session_id: state.session_id,
    cwd: state.cwd,
    model: state.model,
    started_at: state.started_at,
    updated_at: state.updated_at,
    messages: state.messages,
    tool_events: state.tool_events,
    tools_used: uniqueStrings([
      ...state.tools_used,
      ...state.tool_events.map((event) => event.name),
    ]),
    files_touched: uniqueStrings([
      ...state.files_touched,
      ...state.tool_events.flatMap((event) => event.files ?? []),
      ...state.messages.flatMap((message) => message.files ?? []),
    ]),
  };
}

function readClaudeRecord(record: Record<string, unknown>, state: ParserState): void {
  updateCommonMetadata(record, state);

  const type = asString(field(record, 'type'));
  if (type !== CLAUDE_USER_TYPE && type !== CLAUDE_ASSISTANT_TYPE) {
    return;
  }

  const message = asRecord(field(record, 'message'));
  const role = asMessageRole(message ? field(message, 'role') : undefined);
  if (!role) {
    return;
  }

  const createdAt = toIso(field(record, 'timestamp'));
  const extracted = extractContent(
    message ? field(message, 'content') : undefined,
    role,
    createdAt,
  );
  for (const messagePart of extracted.messages) {
    pushMessage(state, messagePart);
  }
  pushToolEvents(state, extracted.toolEvents);
}

function readCodexRecord(record: Record<string, unknown>, state: ParserState): void {
  updateCommonMetadata(record, state);

  const type = asString(field(record, 'type'));
  const payload = asRecord(field(record, 'payload'));
  if (type === 'session_meta' && payload) {
    state.session_id = firstString(field(payload, 'id'), state.session_id);
    state.cwd = firstString(field(payload, 'cwd'), state.cwd);
    state.started_at = earlierIso(state.started_at, toIso(field(payload, 'timestamp')));
    state.updated_at = laterIso(
      state.updated_at,
      toIso(field(record, 'timestamp')) ?? toIso(field(payload, 'timestamp')),
    );
    return;
  }

  if (type === 'turn_context' && payload) {
    state.cwd = firstString(field(payload, 'cwd'), state.cwd);
    state.model = firstString(field(payload, 'model'), state.model);
    return;
  }

  if (type === 'response_item' && payload) {
    readCodexPayload(payload, record, state);
    return;
  }

  if (type === 'event_msg' && payload) {
    readCodexEventPayload(payload, record, state);
  }
}

function readCodexPayload(
  payload: Record<string, unknown>,
  record: Record<string, unknown>,
  state: ParserState,
): void {
  const payloadType = asString(field(payload, 'type'));
  const createdAt = toIso(field(record, 'timestamp'));

  if (payloadType === CODEX_MESSAGE_PAYLOAD_TYPE) {
    const role = asMessageRole(field(payload, 'role'));
    if (!role || role === 'system') {
      return;
    }
    if (isCodexBootstrapContent(field(payload, 'content'))) {
      return;
    }
    const extracted = extractContent(field(payload, 'content'), role, createdAt);
    for (const message of extracted.messages) {
      pushMessage(state, message);
    }
    pushToolEvents(state, extracted.toolEvents);
    return;
  }

  if (payloadType === 'function_call') {
    const name = firstString(field(payload, 'name'), 'unknown_tool') ?? 'unknown_tool';
    const callId = asString(field(payload, 'call_id'));
    if (callId) {
      state.callNames.set(callId, name);
    }

    const input = stringifyCompact(parseMaybeJson(field(payload, 'arguments')));
    const files = collectPathValues(field(payload, 'arguments'));
    pushToolEvents(state, [
      {
        name,
        created_at: createdAt,
        input,
        status: TOOL_STARTED_STATUS,
        files: files.length > 0 ? files : undefined,
      },
    ]);
    pushMessage(
      state,
      withoutEmptyMessage({
        role: 'tool',
        text: input,
        created_at: createdAt,
        tool_name: name,
        files,
      }),
    );
    return;
  }

  if (payloadType === 'function_call_output') {
    const callId = asString(field(payload, 'call_id'));
    const name = (callId ? state.callNames.get(callId) : undefined) ?? 'tool_result';
    const output = stringifyCompact(parseMaybeJson(field(payload, 'output')));
    const files = collectPathValues(field(payload, 'output'));
    pushToolEvents(state, [
      {
        name,
        created_at: createdAt,
        output,
        status: TOOL_COMPLETED_STATUS,
        files: files.length > 0 ? files : undefined,
      },
    ]);
    pushMessage(
      state,
      withoutEmptyMessage({
        role: 'tool',
        text: output,
        created_at: createdAt,
        tool_name: name,
        files,
      }),
    );
  }
}

function readCodexEventPayload(
  payload: Record<string, unknown>,
  record: Record<string, unknown>,
  state: ParserState,
): void {
  const payloadType = asString(field(payload, 'type'));
  if (!payloadType || !CODEX_MESSAGE_EVENT_TYPES.has(payloadType)) {
    return;
  }

  const role: AgentMessageRole = payloadType === 'user_message' ? 'user' : 'assistant';
  const text = firstString(field(payload, 'message'), field(payload, 'text'));
  if (!text) {
    return;
  }

  pushMessage(state, {
    role,
    text: compactText(text),
    created_at: toIso(field(record, 'timestamp')),
  });
}

function updateCommonMetadata(record: Record<string, unknown>, state: ParserState): void {
  state.session_id = firstString(
    field(record, 'sessionId'),
    field(record, 'session_id'),
    state.session_id,
  );
  state.cwd = firstString(field(record, 'cwd'), state.cwd);
  state.started_at = earlierIso(state.started_at, toIso(field(record, 'timestamp')));
  state.updated_at = laterIso(state.updated_at, toIso(field(record, 'timestamp')));
}

function extractContent(
  content: unknown,
  defaultRole: AgentMessageRole,
  createdAt: string | undefined,
): { messages: AgentMessage[]; toolEvents: AgentToolEvent[] } {
  if (typeof content === 'string') {
    return {
      messages: [withoutEmptyMessage({ role: defaultRole, text: content, created_at: createdAt })],
      toolEvents: [],
    };
  }

  if (!Array.isArray(content)) {
    const contentRecord = asRecord(content);
    const text = firstString(contentRecord ? field(contentRecord, 'text') : undefined);
    return {
      messages: text
        ? [withoutEmptyMessage({ role: defaultRole, text, created_at: createdAt })]
        : [],
      toolEvents: [],
    };
  }

  const textParts: string[] = [];
  const messages: AgentMessage[] = [];
  const toolEvents: AgentToolEvent[] = [];

  for (const block of content) {
    const blockRecord = asRecord(block);
    const blockType = asString(blockRecord ? field(blockRecord, 'type') : undefined);
    if (!blockRecord || blockType === 'thinking') {
      continue;
    }

    const text = firstString(field(blockRecord, 'text'));
    if (text && isTextBlock(blockType)) {
      textParts.push(text);
      continue;
    }

    if (blockType === 'tool_use') {
      const name = firstString(field(blockRecord, 'name'), 'tool_use') ?? 'tool_use';
      const input = stringifyCompact(field(blockRecord, 'input'));
      const files = collectPathValues(field(blockRecord, 'input'));
      toolEvents.push({
        name,
        created_at: createdAt,
        input,
        status: TOOL_STARTED_STATUS,
        files: files.length > 0 ? files : undefined,
      });
      messages.push(
        withoutEmptyMessage({
          role: 'tool',
          text: input,
          created_at: createdAt,
          tool_name: name,
          files,
        }),
      );
      continue;
    }

    if (blockType === 'tool_result') {
      const name =
        firstString(field(blockRecord, 'name'), field(blockRecord, 'tool_name'), 'tool_result') ??
        'tool_result';
      const output = stringifyCompact(field(blockRecord, 'content'));
      const files = collectPathValues(field(blockRecord, 'content'));
      toolEvents.push({
        name,
        created_at: createdAt,
        output,
        status: TOOL_COMPLETED_STATUS,
        files: files.length > 0 ? files : undefined,
      });
      messages.push(
        withoutEmptyMessage({
          role: 'tool',
          text: output,
          created_at: createdAt,
          tool_name: name,
          files,
        }),
      );
      continue;
    }

    if (text) {
      textParts.push(text);
    }
  }

  if (textParts.length > 0) {
    messages.unshift(
      withoutEmptyMessage({
        role: defaultRole,
        text: textParts.join('\n\n'),
        created_at: createdAt,
      }),
    );
  }

  return { messages, toolEvents };
}

function isTextBlock(blockType: string | undefined): boolean {
  return (
    !blockType || blockType === 'text' || blockType === 'input_text' || blockType === 'output_text'
  );
}

function isCodexBootstrapContent(content: unknown): boolean {
  const text = extractPreviewText(content);
  return text.startsWith('# AGENTS.md instructions for ') && text.includes('<environment_context>');
}

function extractPreviewText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    const contentRecord = asRecord(content);
    const text = contentRecord ? field(contentRecord, 'text') : undefined;
    return typeof text === 'string' ? text : '';
  }

  return content
    .map((block) => {
      const blockRecord = asRecord(block);
      const text = blockRecord ? field(blockRecord, 'text') : undefined;
      return typeof text === 'string' ? text : '';
    })
    .join('\n');
}

function pushToolEvents(state: ParserState, events: readonly AgentToolEvent[]): void {
  for (const event of events) {
    state.tool_events.push(event);
    state.tools_used.push(event.name);
    state.files_touched.push(...(event.files ?? []));
  }
}

function pushMessage(state: ParserState, message: AgentMessage | undefined): void {
  if (!message || message.text.trim().length === 0) {
    return;
  }

  const normalized = {
    ...message,
    text: compactText(message.text),
    files: message.files && message.files.length > 0 ? uniqueStrings(message.files) : undefined,
  };
  const exists = state.messages.some(
    (existing) =>
      existing.role === normalized.role &&
      existing.tool_name === normalized.tool_name &&
      existing.text === normalized.text,
  );
  if (!exists) {
    state.messages.push(normalized);
  }
}

function withoutEmptyMessage(message: AgentMessage): AgentMessage {
  return {
    ...message,
    text: compactText(message.text),
    files: message.files && message.files.length > 0 ? uniqueStrings(message.files) : undefined,
  };
}

function parseJsonLine(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return asRecord(JSON.parse(trimmed));
  } catch {
    return undefined;
  }
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asMessageRole(value: unknown): AgentMessageRole | undefined {
  if (value === 'user' || value === 'assistant' || value === 'system' || value === 'tool') {
    return value;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}
