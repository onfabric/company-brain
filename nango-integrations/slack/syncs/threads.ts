import { createSync, type ProxyConfiguration } from 'nango';
import { z } from 'zod';

// Slack timestamps are Unix seconds, while JS Date works in milliseconds.
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * MILLISECONDS_PER_SECOND;

// Default lookback window for re-reading already-synced channels to catch
// edits, replies, and reactions on recent root messages.
const DEFAULT_RESYNC_WINDOW_DAYS = 10;

// Per-request page sizes for the Slack endpoints we paginate.
const USERS_PAGE_SIZE = 200;
const CHANNELS_PAGE_SIZE = 200;
const HISTORY_PAGE_SIZE = 100;
const REPLIES_PAGE_SIZE = 100;

// Retry budget applied to every proxied Slack call.
const PROXY_RETRIES = 3;

const SlackActorSchema = z.object({
  id: z.string(),
  kind: z.enum(['user', 'bot', 'unknown']),
  name: z.string(),
  team_id: z.string().optional(),
  username: z.string().optional(),
  real_name: z.string().optional(),
  display_name: z.string().optional(),
  email: z.string().optional(),
  is_bot: z.boolean().optional(),
  deleted: z.boolean().optional(),
  avatar_url: z.string().optional(),
  updated_at: z.string().optional(),
});

const SlackActorRefSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});

const SlackChannelSchema = z.string();

const SlackReactionSchema = z.object({
  name: z.string(),
  actors: z.array(SlackActorRefSchema),
});

const SlackFileSchema = z.object({
  author: SlackActorRefSchema,
  created_at: z.string(),
  permalink: z.string(),
});

const SlackLinkSchema = z.object({
  url: z.string(),
});

const SlackThreadMessageSchema = z.object({
  created_at: z.string(),
  updated_at: z.string().optional(),
  author: SlackActorRefSchema,
  text: z.string(),
  mentions: z.array(SlackActorRefSchema).optional(),
  reactions: z.array(SlackReactionSchema).optional(),
  files: z.array(SlackFileSchema).optional(),
  links: z.array(SlackLinkSchema).optional(),
});

const SlackThreadSchema = z.object({
  id: z.string(),
  body: z.string(),
  channel: SlackChannelSchema,
  created_at: z.string(),
  updated_at: z.string(),
  messages: z.array(SlackThreadMessageSchema),
});

const MetadataSchema = z.object({
  joinPublicChannels: z
    .boolean()
    .optional()
    .describe('Whether to auto-join public channels before reading their history'),
  includeArchived: z.boolean().optional().describe('Whether to include archived conversations'),
  channelTypes: z.string().optional().describe('Comma-separated Slack conversation types to sync'),
  resyncWindowDays: z
    .number()
    .optional()
    .describe('How far back to re-read existing channels to catch edits, replies, and reactions'),
  maxChannelsPerRun: z
    .number()
    .optional()
    .describe('Optional cap for channel processing in one execution'),
});

const CheckpointSchema = z.object({
  channelsLastSyncDateJson: z.string(),
  lastSyncDate: z.string(),
});

type SlackActor = z.infer<typeof SlackActorSchema>;
type SlackActorRef = z.infer<typeof SlackActorRefSchema>;
type SlackChannel = z.infer<typeof SlackChannelSchema>;
type SlackFile = z.infer<typeof SlackFileSchema>;
type SlackLink = z.infer<typeof SlackLinkSchema>;
type SlackThread = z.infer<typeof SlackThreadSchema>;
type SlackThreadMessage = z.infer<typeof SlackThreadMessageSchema>;

type RawSlackUser = {
  id?: string;
  team_id?: string;
  name?: string;
  real_name?: string;
  is_bot?: boolean;
  deleted?: boolean;
  updated?: number;
  profile?: {
    real_name?: string;
    display_name?: string;
    email?: string;
    image_72?: string;
    image_192?: string;
    bot_id?: string;
  };
};

type RawSlackChannel = {
  id: string;
  context_team_id?: string;
  team_id?: string;
  name?: string;
  name_normalized?: string;
  created?: number;
  creator?: string;
  updated?: number;
  is_archived?: boolean;
  is_general?: boolean;
  is_private?: boolean;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_shared?: boolean;
  is_org_shared?: boolean;
  is_ext_shared?: boolean;
  is_member?: boolean;
  num_members?: number;
  previous_names?: string[];
  topic?: {
    value?: string;
    creator?: string;
    last_set?: number;
  };
  purpose?: {
    value?: string;
    creator?: string;
    last_set?: number;
  };
};

type RawSlackMessage = {
  type?: string;
  subtype?: string;
  user?: string;
  username?: string;
  client_msg_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  parent_user_id?: string;
  reply_count?: number;
  latest_reply?: string;
  reply_users?: string[];
  team?: string;
  bot_id?: string;
  app_id?: string;
  bot_profile?: {
    id?: string;
    name?: string;
    user_id?: string;
    team_id?: string;
    deleted?: boolean;
    updated?: number;
    icons?: {
      image_36?: string;
      image_48?: string;
      image_72?: string;
    };
  };
  blocks?: unknown[];
  attachments?: unknown[];
  reactions?: {
    name?: string;
    count?: number;
    users?: string[];
  }[];
  files?: {
    id?: string;
    name?: string;
    title?: string;
    mimetype?: string;
    filetype?: string;
    url_private?: string;
    permalink?: string;
    size?: number;
    created?: number;
    user?: string;
  }[];
  edited?: {
    user?: string;
    ts?: string;
  };
};

function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

const sync = createSync({
  description:
    'Sync self-contained Slack thread records with channel context, message authors, mentions, files, links, and reactions',
  version: '2.0.0',
  endpoints: [{ method: 'POST', path: '/syncs/threads', group: 'Threads' }],
  frequency: 'every hour',
  autoStart: true,
  metadata: MetadataSchema,
  checkpoint: CheckpointSchema,

  models: {
    SlackThread: SlackThreadSchema,
  },

  exec: async (nango) => {
    const metadata = parseOptional(MetadataSchema, await nango.getMetadata());
    const checkpoint = parseOptional(CheckpointSchema, await nango.getCheckpoint());

    const usersById = await fetchUsersById(nango);
    const channels = await fetchChannels(nango, metadata);
    const channelsToProcess =
      typeof metadata?.maxChannelsPerRun === 'number' && metadata.maxChannelsPerRun > 0
        ? channels.slice(0, metadata.maxChannelsPerRun)
        : channels;
    const channelsLastSyncDate = parseChannelsLastSyncDate(checkpoint?.channelsLastSyncDateJson);
    const updatedChannelsLastSyncDate: Record<string, string> = {
      ...channelsLastSyncDate,
    };
    const resyncWindowDays = metadata?.resyncWindowDays ?? DEFAULT_RESYNC_WINDOW_DAYS;
    const resyncWindowTs = String(
      (Date.now() - resyncWindowDays * MILLISECONDS_PER_DAY) / MILLISECONDS_PER_SECOND,
    );
    const syncUpperBoundTs = String(Date.now() / MILLISECONDS_PER_SECOND);

    const ctx: ChannelProcessingContext = {
      usersById,
      channelsLastSyncDate,
      updatedChannelsLastSyncDate,
      resyncWindowTs,
      syncUpperBoundTs,
    };

    // Process channels one at a time. Threads are saved per conversations.history
    // page (see processChannel) and the checkpoint is advanced after each channel,
    // so a rate limit or crash mid-run still leaves already-synced threads in the
    // db and lets the next execution resume from the last completed channel instead
    // of refetching everything.
    for (const rawChannel of channelsToProcess) {
      if (await ensureReadableChannel(nango, rawChannel, metadata)) {
        await processChannel(nango, rawChannel, ctx);
      }
    }

    // Final checkpoint also refreshes lastSyncDate when no channels advanced it.
    await nango.saveCheckpoint({
      channelsLastSyncDateJson: JSON.stringify(updatedChannelsLastSyncDate),
      lastSyncDate: new Date().toISOString(),
    });
  },
});

async function fetchUsersById(nango: NangoSyncLocal): Promise<Map<string, SlackActor>> {
  const usersById = new Map<string, SlackActor>();
  const proxyConfig = {
    endpoint: 'users.list',
    params: {
      limit: USERS_PAGE_SIZE,
    },
    paginate: {
      type: 'cursor',
      cursor_path_in_response: 'response_metadata.next_cursor',
      cursor_name_in_request: 'cursor',
      response_path: 'members',
      limit_name_in_request: 'limit',
      limit: USERS_PAGE_SIZE,
    },
    retries: PROXY_RETRIES,
  } satisfies ProxyConfiguration;

  for await (const batch of nango.paginate(proxyConfig)) {
    for (const rawUser of batch as RawSlackUser[]) {
      if (!rawUser.id) {
        continue;
      }
      usersById.set(rawUser.id, mapUser(rawUser));
    }
  }

  return usersById;
}

async function fetchChannels(
  nango: NangoSyncLocal,
  metadata: z.infer<typeof MetadataSchema> | undefined,
): Promise<RawSlackChannel[]> {
  const channels: RawSlackChannel[] = [];
  const proxyConfig = {
    endpoint: 'conversations.list',
    params: {
      types: metadata?.channelTypes ?? 'public_channel,private_channel,mpim,im',
      exclude_archived: metadata?.includeArchived ? 'false' : 'true',
      limit: CHANNELS_PAGE_SIZE,
    },
    paginate: {
      type: 'cursor',
      cursor_path_in_response: 'response_metadata.next_cursor',
      cursor_name_in_request: 'cursor',
      response_path: 'channels',
      limit_name_in_request: 'limit',
      limit: CHANNELS_PAGE_SIZE,
    },
    retries: PROXY_RETRIES,
  } satisfies ProxyConfiguration;

  for await (const batch of nango.paginate(proxyConfig)) {
    channels.push(...(batch as RawSlackChannel[]));
  }

  return channels;
}

async function ensureReadableChannel(
  nango: NangoSyncLocal,
  channel: RawSlackChannel,
  metadata: z.infer<typeof MetadataSchema> | undefined,
): Promise<boolean> {
  if (channel.is_member) {
    return true;
  }

  if (channel.is_private) {
    return false;
  }

  const shouldJoinPublicChannels = metadata?.joinPublicChannels ?? true;
  if (!shouldJoinPublicChannels || !channel.is_channel) {
    return false;
  }

  try {
    await nango.post({
      endpoint: 'conversations.join',
      data: { channel: channel.id },
      retries: PROXY_RETRIES,
    });
    return true;
  } catch {
    return false;
  }
}

type ChannelProcessingContext = {
  usersById: Map<string, SlackActor>;
  channelsLastSyncDate: Record<string, string>;
  updatedChannelsLastSyncDate: Record<string, string>;
  resyncWindowTs: string;
  syncUpperBoundTs: string;
};

async function processChannel(
  nango: NangoSyncLocal,
  rawChannel: RawSlackChannel,
  ctx: ChannelProcessingContext,
): Promise<void> {
  const lastSync = ctx.channelsLastSyncDate[rawChannel.id];
  // We poll a bounded snapshot so the checkpoint never advances past messages
  // that were posted while this execution was already running. This window is
  // still based on root message timestamps returned by conversations.history,
  // not on thread activity. That means updates to threads whose root message is
  // older than the resync window can be missed: new replies, edits/deletes,
  // reaction changes, or file changes on old messages will not be noticed until
  // a wider backfill catches the root again. TODO: add Slack Events API webhook
  // handling so message_changed, message_deleted, reaction, and new-reply events
  // rebuild the affected SlackThread immediately by channel_id + thread_ts.
  const oldest = lastSync ? Math.max(Number(lastSync), Number(ctx.resyncWindowTs)) : 0;
  const channel = mapChannel(rawChannel);

  const maxSeenTs = await processRootMessagePages(
    nango,
    rawChannel.id,
    channel,
    ctx,
    oldest.toString(),
    undefined,
    Number(lastSync ?? 0),
  );

  ctx.updatedChannelsLastSyncDate[rawChannel.id] = String(
    Math.max(maxSeenTs, Number(ctx.syncUpperBoundTs)),
  );

  // Advance the checkpoint as soon as a channel is fully processed so progress
  // survives a later rate limit or crash. Threads themselves were already saved
  // per page inside processRootMessagePages.
  await nango.saveCheckpoint({
    channelsLastSyncDateJson: JSON.stringify(ctx.updatedChannelsLastSyncDate),
    lastSyncDate: new Date().toISOString(),
  });
}

// Walks conversations.history one page at a time, saving each page's threads
// before fetching the next page. Returns the latest thread timestamp seen.
async function processRootMessagePages(
  nango: NangoSyncLocal,
  channelId: string,
  channel: SlackChannel,
  ctx: ChannelProcessingContext,
  oldest: string,
  cursor: string | undefined,
  maxSeenTs: number,
): Promise<number> {
  const response = await nango.get({
    endpoint: 'conversations.history',
    params: {
      channel: channelId,
      oldest,
      latest: ctx.syncUpperBoundTs,
      limit: HISTORY_PAGE_SIZE,
      ...(cursor && { cursor }),
    },
    retries: PROXY_RETRIES,
  });

  const batch = response.data?.messages;
  if (!Array.isArray(batch)) {
    return maxSeenTs;
  }

  const rootMessages = (batch as RawSlackMessage[]).filter(isThreadRootMessage);
  const { threads, maxSeenTs: pageMaxSeenTs } = await buildThreadsForRoots(
    nango,
    channelId,
    channel,
    rootMessages,
    ctx.usersById,
    maxSeenTs,
  );

  if (threads.length > 0) {
    await nango.batchSave(threads, 'SlackThread');
  }

  const hasMore = Boolean(response.data?.has_more);
  const nextCursor = response.data?.response_metadata?.next_cursor;

  if (!hasMore || !nextCursor) {
    return pageMaxSeenTs;
  }

  return processRootMessagePages(nango, channelId, channel, ctx, oldest, nextCursor, pageMaxSeenTs);
}

async function buildThreadsForRoots(
  nango: NangoSyncLocal,
  channelId: string,
  channel: SlackChannel,
  rootMessages: RawSlackMessage[],
  usersById: Map<string, SlackActor>,
  maxSeenTs: number,
): Promise<{ threads: SlackThread[]; maxSeenTs: number }> {
  const threads: SlackThread[] = [];

  for (const rootMessage of rootMessages) {
    const fetchedThreadMessages =
      rootMessage.reply_count && rootMessage.reply_count > 0
        ? await fetchThreadMessages(nango, channelId, rootMessage.thread_ts ?? rootMessage.ts)
        : [rootMessage];
    const threadMessages = fetchedThreadMessages.length > 0 ? fetchedThreadMessages : [rootMessage];

    const thread = buildThread(channelId, channel, threadMessages, usersById);
    if (thread) {
      threads.push(thread);
      maxSeenTs = Math.max(
        maxSeenTs,
        Number(
          thread.updated_at
            ? Date.parse(thread.updated_at) / MILLISECONDS_PER_SECOND
            : rootMessage.ts,
        ),
      );
    }
  }

  return { threads, maxSeenTs };
}

async function fetchThreadMessages(
  nango: NangoSyncLocal,
  channelId: string,
  threadTs: string,
  cursor?: string,
  accumulated: RawSlackMessage[] = [],
): Promise<RawSlackMessage[]> {
  try {
    const response = await nango.get({
      endpoint: 'conversations.replies',
      params: {
        channel: channelId,
        ts: threadTs,
        limit: REPLIES_PAGE_SIZE,
        ...(cursor && { cursor }),
      },
      retries: PROXY_RETRIES,
    });

    const batch = response.data?.messages;
    if (!Array.isArray(batch)) {
      return accumulated;
    }

    const messages = [...accumulated, ...(batch as RawSlackMessage[]).filter(isContentMessage)];
    const hasMore = Boolean(response.data?.has_more);
    const nextCursor = response.data?.response_metadata?.next_cursor;

    if (!hasMore || !nextCursor) {
      return messages;
    }

    return fetchThreadMessages(nango, channelId, threadTs, nextCursor, messages);
  } catch {
    return accumulated;
  }
}

function buildThread(
  channelId: string,
  channel: SlackChannel,
  rawMessages: RawSlackMessage[],
  usersById: Map<string, SlackActor>,
): SlackThread | undefined {
  const messages = rawMessages.filter(isContentMessage).sort((a, b) => Number(a.ts) - Number(b.ts));
  const rootMessage = messages[0];

  if (!rootMessage) {
    return undefined;
  }

  const rootTs = rootMessage.thread_ts ?? rootMessage.ts;
  let latestTimestamp = Number(rootMessage.ts);

  const mappedMessages: SlackThreadMessage[] = messages.map((rawMessage) => {
    const author = resolveAuthor(rawMessage, usersById);

    const mentions = getMentionedActorIds(rawMessage).map((actorId) =>
      toActorRef(usersById.get(actorId) ?? unknownActor(actorId, rawMessage.team)),
    );

    const reactions = mapReactions(rawMessage, usersById, rawMessage.team);

    const files = mapFiles(rawMessage, usersById, author);
    for (const file of files) {
      latestTimestamp = Math.max(
        latestTimestamp,
        Date.parse(file.created_at ?? slackTsToIso(rawMessage.ts)) / MILLISECONDS_PER_SECOND,
      );
    }

    latestTimestamp = Math.max(latestTimestamp, Number(rawMessage.edited?.ts ?? rawMessage.ts));

    const links = mapLinks(rawMessage);
    const text = renderSlackText(rawMessage.text ?? '', usersById);

    return withoutUndefined({
      created_at: slackTsToIso(rawMessage.ts),
      updated_at: rawMessage.edited?.ts ? slackTsToIso(rawMessage.edited.ts) : undefined,
      author: toActorRef(author),
      text,
      mentions: mentions.length > 0 ? sortActorRefs(mentions) : undefined,
      reactions: reactions.length > 0 ? reactions : undefined,
      files: files.length > 0 ? files : undefined,
      links: links.length > 0 ? links : undefined,
    });
  });

  const createdAt = slackTsToIso(rootMessage.ts);
  const updatedAt = slackTsToIso(String(latestTimestamp));

  return {
    id: `${channelId}-${rootTs}`,
    body: renderThreadBody(channel, createdAt, updatedAt, mappedMessages),
    channel,
    created_at: createdAt,
    updated_at: updatedAt,
    messages: mappedMessages,
  };
}

function isThreadRootMessage(message: RawSlackMessage): boolean {
  return isContentMessage(message) && (!message.thread_ts || message.thread_ts === message.ts);
}

function isContentMessage(message: RawSlackMessage): boolean {
  if (message.type && message.type !== 'message') {
    return false;
  }

  if (!message.subtype) {
    return true;
  }

  return ['bot_message', 'file_share'].includes(message.subtype);
}

function mapUser(user: RawSlackUser): SlackActor {
  const name =
    firstNonEmpty(
      user.profile?.display_name,
      user.profile?.real_name,
      user.real_name,
      user.name,
      user.id,
    ) ?? 'unknown';

  return withoutUndefined({
    id: user.id!,
    kind: user.is_bot ? 'bot' : 'user',
    name,
    team_id: user.team_id,
    username: user.name,
    real_name: firstNonEmpty(user.profile?.real_name, user.real_name),
    display_name: user.profile?.display_name || undefined,
    email: user.profile?.email,
    is_bot: user.is_bot,
    deleted: user.deleted,
    avatar_url: firstNonEmpty(user.profile?.image_72, user.profile?.image_192),
    updated_at: user.updated ? slackSecondsToIso(user.updated) : undefined,
  });
}

function mapChannel(channel: RawSlackChannel): SlackChannel {
  const name = firstNonEmpty(channel.name_normalized, channel.name);
  if (name) {
    return name;
  }

  if (channel.is_im) {
    return 'direct-message';
  }
  if (channel.is_mpim) {
    return 'group-dm';
  }
  if (channel.is_private || channel.is_group) {
    return 'private-channel';
  }
  if (channel.is_channel) {
    return 'public-channel';
  }
  return 'unknown-channel';
}

function resolveAuthor(message: RawSlackMessage, usersById: Map<string, SlackActor>): SlackActor {
  const authorId = message.user ?? message.bot_profile?.user_id ?? message.bot_id ?? 'unknown';
  const knownUser = usersById.get(authorId);

  if (knownUser) {
    return knownUser;
  }

  if (message.bot_profile) {
    return withoutUndefined({
      id: authorId,
      kind: 'bot',
      name: message.bot_profile.name ?? message.username ?? message.bot_id ?? authorId,
      team_id: message.bot_profile.team_id ?? message.team,
      username: message.username,
      is_bot: true,
      deleted: message.bot_profile.deleted,
      avatar_url:
        message.bot_profile.icons?.image_72 ??
        message.bot_profile.icons?.image_48 ??
        message.bot_profile.icons?.image_36,
      updated_at: message.bot_profile.updated
        ? slackSecondsToIso(message.bot_profile.updated)
        : undefined,
    });
  }

  return unknownActor(authorId, message.team);
}

function unknownActor(id: string, teamId?: string): SlackActor {
  return withoutUndefined({
    id,
    kind: 'unknown',
    name: id,
    team_id: teamId,
  });
}

function mapReactions(
  message: RawSlackMessage,
  usersById: Map<string, SlackActor>,
  teamId: string | undefined,
): z.infer<typeof SlackReactionSchema>[] {
  return (
    message.reactions
      ?.filter((reaction) => reaction.name)
      .map((reaction) => ({
        name: reaction.name!,
        actors: sortActorRefs(
          [...new Set(reaction.users ?? [])].map((actorId) =>
            toActorRef(usersById.get(actorId) ?? unknownActor(actorId, teamId)),
          ),
        ),
      })) ?? []
  );
}

function mapFiles(
  message: RawSlackMessage,
  usersById: Map<string, SlackActor>,
  author: SlackActor,
): SlackFile[] {
  return (
    message.files
      ?.filter((file) => file.permalink)
      .map((file) =>
        withoutUndefined({
          created_at: file.created ? slackSecondsToIso(file.created) : slackTsToIso(message.ts),
          author: file.user
            ? toActorRef(
                file.user === author.id
                  ? author
                  : (usersById.get(file.user) ?? unknownActor(file.user, message.team)),
              )
            : toActorRef(author),
          permalink: file.permalink!,
        }),
      ) ?? []
  );
}

function mapLinks(message: RawSlackMessage): SlackLink[] {
  const links = new Map<string, SlackLink>();
  const text = message.text ?? '';
  const slackLinkPattern = /<((?:https?:\/\/|mailto:)[^>|]+)(?:\|([^>]+))?>/g;
  const plainUrlPattern = /(^|\s)((?:https?:\/\/|mailto:)[^\s<]+)/g;

  for (const match of text.matchAll(slackLinkPattern)) {
    const url = match[1];
    if (url) {
      links.set(url, { url });
    }
  }

  for (const match of text.matchAll(plainUrlPattern)) {
    const url = match[2];
    if (url && !links.has(url)) {
      links.set(url, { url });
    }
  }

  return [...links.values()];
}

function renderSlackText(text: string, usersById: Map<string, SlackActor>): string {
  return decodeSlackEntities(
    text
      .replace(
        /<@([A-Z0-9]+)(?:\|[^>]+)?>/g,
        (_match, actorId: string) =>
          `@${actorName(usersById.get(actorId) ?? unknownActor(actorId))}`,
      )
      .replace(
        /<#([A-Z0-9]+)(?:\|([^>]+))?>/g,
        (_match, channelId: string, label: string | undefined) =>
          label ? `#${label}` : `#${channelId}`,
      )
      .replace(
        /<!subteam\^[A-Z0-9]+(?:\|([^>]+))?>/g,
        (_match, label: string | undefined) => label ?? '@usergroup',
      )
      .replace(/<!(here|channel|everyone)>/g, (_match, label: string) => `@${label}`)
      .replace(
        /<((?:https?:\/\/|mailto:)[^>|]+)\|([^>]+)>/g,
        (_match, url: string, label: string) => `${label} (${url})`,
      )
      .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/g, (_match, url: string) => url),
  ).trim();
}

function renderThreadBody(
  channel: SlackChannel,
  createdAt: string,
  updatedAt: string,
  messages: SlackThreadMessage[],
): string {
  const lines = [
    `# Slack thread in #${channel}`,
    '',
    `- Started: ${createdAt}`,
    `- Last activity: ${updatedAt}`,
    '',
  ];

  for (const message of messages) {
    lines.push(`## ${message.created_at} - ${renderActor(message.author)}`);
    lines.push('');
    lines.push(message.text || '(no text)');

    if (message.mentions && message.mentions.length > 0) {
      lines.push('');
      lines.push(`Mentions: ${message.mentions.map(renderActor).join(', ')}`);
    }

    if (message.files && message.files.length > 0) {
      lines.push('');
      lines.push('Files:');
      for (const file of message.files) {
        lines.push(`- ${renderFile(file)}`);
      }
    }

    if (message.reactions && message.reactions.length > 0) {
      lines.push('');
      lines.push('Reactions:');
      for (const reaction of message.reactions) {
        lines.push(`- ${renderReaction(reaction)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

function renderFile(file: SlackFile): string {
  return `${file.created_at} - ${renderActor(file.author)} - ${file.permalink}`;
}

function renderReaction(reaction: z.infer<typeof SlackReactionSchema>): string {
  const actorNames = reaction.actors.map(renderActor).join(', ');
  return actorNames ? `${reaction.name} by ${actorNames}` : reaction.name;
}

function renderActor(actor: SlackActorRef): string {
  return actor.email ? `${actor.name} <${actor.email}>` : actor.name;
}

function decodeSlackEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function toActorRef(actor: SlackActor): SlackActorRef {
  return withoutUndefined({
    name: actorName(actor),
    email: actor.email,
  });
}

function actorName(actor: SlackActor): string {
  return (
    firstNonEmpty(actor.display_name, actor.real_name, actor.name, actor.username, actor.id) ??
    actor.id
  );
}

function sortActorRefs(actors: SlackActorRef[]): SlackActorRef[] {
  return actors.sort(
    (a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? ''),
  );
}

function getMentionedActorIds(message: RawSlackMessage): string[] {
  const ids = new Set<string>();
  const text = message.text ?? '';

  for (const match of text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }

  collectMentionsFromBlocks(message.blocks, ids);

  return [...ids].sort();
}

function collectMentionsFromBlocks(value: unknown, ids: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectMentionsFromBlocks(item, ids);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;
  // biome-ignore lint/complexity/useLiteralKeys: index-signature access requires brackets under tsconfig noPropertyAccessFromIndexSignature
  if (record['type'] === 'user' && typeof record['user_id'] === 'string') {
    // biome-ignore lint/complexity/useLiteralKeys: index-signature access requires brackets under tsconfig noPropertyAccessFromIndexSignature
    ids.add(record['user_id']);
  }

  for (const nested of Object.values(record)) {
    collectMentionsFromBlocks(nested, ids);
  }
}

function parseChannelsLastSyncDate(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function slackTsToIso(ts: string): string {
  return new Date(Number(ts) * MILLISECONDS_PER_SECOND).toISOString();
}

function slackSecondsToIso(seconds: number): string {
  return new Date(seconds * MILLISECONDS_PER_SECOND).toISOString();
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0);
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export type NangoSyncLocal = Parameters<(typeof sync)['exec']>[0];
export default sync;
