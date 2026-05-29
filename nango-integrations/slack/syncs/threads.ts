import { createSync, type ProxyConfiguration } from 'nango';
import { z } from 'zod';

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
    updated_at: z.string().optional()
});

const SlackChannelSchema = z.object({
    id: z.string(),
    team_id: z.string().optional(),
    type: z.enum(['public_channel', 'private_channel', 'mpim', 'im', 'unknown']),
    name: z.string().optional(),
    name_normalized: z.string().optional(),
    is_private: z.boolean(),
    is_archived: z.boolean(),
    is_shared: z.boolean().optional(),
    is_org_shared: z.boolean().optional(),
    is_ext_shared: z.boolean().optional(),
    is_general: z.boolean().optional(),
    creator_id: z.string().optional(),
    num_members: z.number().optional(),
    previous_names: z.array(z.string()).optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    topic: z
        .object({
            value: z.string(),
            creator_id: z.string().optional(),
            updated_at: z.string().optional()
        })
        .optional(),
    purpose: z
        .object({
            value: z.string(),
            creator_id: z.string().optional(),
            updated_at: z.string().optional()
        })
        .optional()
});

const SlackReactionSchema = z.object({
    name: z.string(),
    count: z.number(),
    actor_ids: z.array(z.string())
});

const SlackFileSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    mimetype: z.string().optional(),
    filetype: z.string().optional(),
    url_private: z.string().optional(),
    permalink: z.string().optional(),
    size: z.number().optional(),
    created_at: z.string().optional(),
    actor_id: z.string().optional()
});

const SlackLinkSchema = z.object({
    url: z.string(),
    label: z.string().optional()
});

const SlackThreadMessageSchema = z.object({
    id: z.string(),
    ts: z.string(),
    thread_ts: z.string(),
    created_at: z.string(),
    updated_at: z.string().optional(),
    edited_by_id: z.string().optional(),
    client_msg_id: z.string().optional(),
    author_id: z.string(),
    parent_author_id: z.string().optional(),
    type: z.string(),
    subtype: z.string().optional(),
    text: z.string(),
    blocks: z.array(z.unknown()).optional(),
    attachments: z.array(z.unknown()).optional(),
    reactions: z.array(SlackReactionSchema).optional(),
    files: z.array(SlackFileSchema).optional(),
    links: z.array(SlackLinkSchema).optional(),
    mentioned_actor_ids: z.array(z.string()).optional(),
    bot_id: z.string().optional(),
    app_id: z.string().optional()
});

const SlackThreadSchema = z.object({
    id: z.string(),
    team_id: z.string().optional(),
    channel: SlackChannelSchema,
    root_ts: z.string(),
    permalink: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    actors: z.record(z.string(), SlackActorSchema),
    facets: z.object({
        channel_id: z.string(),
        root_author_id: z.string(),
        author_ids: z.array(z.string()),
        actor_ids: z.array(z.string()),
        mentioned_actor_ids: z.array(z.string()),
        has_replies: z.boolean(),
        has_files: z.boolean(),
        has_reactions: z.boolean()
    }),
    counts: z.object({
        messages: z.number(),
        replies: z.number(),
        actors: z.number(),
        files: z.number(),
        reactions: z.number()
    }),
    messages: z.array(SlackThreadMessageSchema)
});

const MetadataSchema = z.object({
    joinPublicChannels: z.boolean().optional().describe('Whether to auto-join public channels before reading their history'),
    includeArchived: z.boolean().optional().describe('Whether to include archived conversations'),
    channelTypes: z.string().optional().describe('Comma-separated Slack conversation types to sync'),
    resyncWindowDays: z.number().optional().describe('How far back to re-read existing channels to catch edits, replies, and reactions'),
    maxChannelsPerRun: z.number().optional().describe('Optional cap for channel processing in one execution')
});

const CheckpointSchema = z.object({
    channelsLastSyncDateJson: z.string(),
    lastSyncDate: z.string()
});

type SlackActor = z.infer<typeof SlackActorSchema>;
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
    description: 'Sync self-contained Slack thread records with channel context, message authors, mentions, files, links, and reactions',
    version: '1.0.0',
    endpoints: [{ method: 'POST', path: '/syncs/threads', group: 'Threads' }],
    frequency: 'every hour',
    autoStart: true,
    metadata: MetadataSchema,
    checkpoint: CheckpointSchema,

    models: {
        SlackThread: SlackThreadSchema
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
        const updatedChannelsLastSyncDate: Record<string, string> = { ...channelsLastSyncDate };
        const resyncWindowDays = metadata?.resyncWindowDays ?? 10;
        const resyncWindowTs = String((Date.now() - resyncWindowDays * 24 * 60 * 60 * 1000) / 1000);
        const syncUpperBoundTs = String(Date.now() / 1000);

        for (const rawChannel of channelsToProcess) {
            if (!(await ensureReadableChannel(nango, rawChannel, metadata))) {
                continue;
            }

            const lastSync = channelsLastSyncDate[rawChannel.id];
            // We poll a bounded snapshot so the checkpoint never advances past
            // messages that were posted while this execution was already running.
            // This window is still based on root message timestamps returned by
            // conversations.history, not on thread activity. That means updates to
            // threads whose root message is older than the resync window can be
            // missed: new replies, edits/deletes, reaction changes, or file changes
            // on old messages will not be noticed until a wider backfill catches the
            // root again. TODO: add Slack Events API webhook handling so
            // message_changed, message_deleted, reaction, and new-reply events
            // rebuild the affected SlackThread immediately by channel_id + thread_ts.
            const oldest = lastSync ? Math.max(Number(lastSync), Number(resyncWindowTs)).toString() : '0';
            const channel = mapChannel(rawChannel);
            const rootMessages = await fetchRootMessages(nango, rawChannel.id, oldest, syncUpperBoundTs);
            const threads: SlackThread[] = [];
            let maxSeenTs = Number(lastSync ?? 0);

            for (const rootMessage of rootMessages) {
                const fetchedThreadMessages =
                    rootMessage.reply_count && rootMessage.reply_count > 0
                        ? await fetchThreadMessages(nango, rawChannel.id, rootMessage.thread_ts ?? rootMessage.ts)
                        : [rootMessage];
                const threadMessages = fetchedThreadMessages.length > 0 ? fetchedThreadMessages : [rootMessage];

                const thread = buildThread(channel, threadMessages, usersById);
                if (thread) {
                    threads.push(thread);
                    maxSeenTs = Math.max(maxSeenTs, Number(thread.updated_at ? Date.parse(thread.updated_at) / 1000 : rootMessage.ts));
                }
            }

            if (threads.length > 0) {
                await nango.batchSave(threads, 'SlackThread');
            }

            updatedChannelsLastSyncDate[rawChannel.id] = String(Math.max(maxSeenTs, Number(syncUpperBoundTs)));
        }

        await nango.saveCheckpoint({
            channelsLastSyncDateJson: JSON.stringify(updatedChannelsLastSyncDate),
            lastSyncDate: new Date().toISOString()
        });
    }
});

async function fetchUsersById(nango: any): Promise<Map<string, SlackActor>> {
    const usersById = new Map<string, SlackActor>();
    const proxyConfig = {
        endpoint: 'users.list',
        params: {
            limit: 200
        },
        paginate: {
            type: 'cursor',
            cursor_path_in_response: 'response_metadata.next_cursor',
            cursor_name_in_request: 'cursor',
            response_path: 'members',
            limit_name_in_request: 'limit',
            limit: 200
        },
        retries: 3
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

async function fetchChannels(nango: any, metadata: z.infer<typeof MetadataSchema> | undefined): Promise<RawSlackChannel[]> {
    const channels: RawSlackChannel[] = [];
    const proxyConfig = {
        endpoint: 'conversations.list',
        params: {
            types: metadata?.channelTypes ?? 'public_channel,private_channel,mpim,im',
            exclude_archived: metadata?.includeArchived ? 'false' : 'true',
            limit: 200
        },
        paginate: {
            type: 'cursor',
            cursor_path_in_response: 'response_metadata.next_cursor',
            cursor_name_in_request: 'cursor',
            response_path: 'channels',
            limit_name_in_request: 'limit',
            limit: 200
        },
        retries: 3
    } satisfies ProxyConfiguration;

    for await (const batch of nango.paginate(proxyConfig)) {
        channels.push(...(batch as RawSlackChannel[]));
    }

    return channels;
}

async function ensureReadableChannel(
    nango: any,
    channel: RawSlackChannel,
    metadata: z.infer<typeof MetadataSchema> | undefined
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
            retries: 3
        });
        return true;
    } catch {
        return false;
    }
}

async function fetchRootMessages(nango: any, channelId: string, oldest: string, latest: string): Promise<RawSlackMessage[]> {
    const messages: RawSlackMessage[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
        const response = await nango.get({
            endpoint: 'conversations.history',
            params: {
                channel: channelId,
                oldest,
                latest,
                limit: 100,
                ...(cursor && { cursor })
            },
            retries: 3
        });

        const batch = response.data?.messages;
        if (!Array.isArray(batch)) {
            break;
        }

        messages.push(...batch.filter(isThreadRootMessage));
        hasMore = Boolean(response.data?.has_more);
        cursor = response.data?.response_metadata?.next_cursor;

        if (!hasMore || !cursor) {
            break;
        }
    }

    return messages;
}

async function fetchThreadMessages(nango: any, channelId: string, threadTs: string): Promise<RawSlackMessage[]> {
    const messages: RawSlackMessage[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await nango.get({
                endpoint: 'conversations.replies',
                params: {
                    channel: channelId,
                    ts: threadTs,
                    limit: 100,
                    ...(cursor && { cursor })
                },
                retries: 3
            });

            const batch = response.data?.messages;
            if (!Array.isArray(batch)) {
                break;
            }

            messages.push(...batch.filter(isContentMessage));
            hasMore = Boolean(response.data?.has_more);
            cursor = response.data?.response_metadata?.next_cursor;

            if (!hasMore || !cursor) {
                break;
            }
        } catch {
            break;
        }
    }

    return messages;
}

function buildThread(channel: SlackChannel, rawMessages: RawSlackMessage[], usersById: Map<string, SlackActor>): SlackThread | undefined {
    const messages = rawMessages.filter(isContentMessage).sort((a, b) => Number(a.ts) - Number(b.ts));
    const rootMessage = messages[0];

    if (!rootMessage) {
        return undefined;
    }

    const rootTs = rootMessage.thread_ts ?? rootMessage.ts;
    const teamId = rootMessage.team ?? channel.team_id;
    const actors: Record<string, SlackActor> = {};
    const authorIds = new Set<string>();
    const mentionedActorIds = new Set<string>();
    let fileCount = 0;
    let reactionCount = 0;
    let latestTimestamp = Number(rootMessage.ts);

    const mappedMessages: SlackThreadMessage[] = messages.map((rawMessage) => {
        const author = resolveAuthor(rawMessage, usersById);
        setActor(actors, author);
        authorIds.add(author.id);

        const mentionedIds = getMentionedActorIds(rawMessage);
        for (const actorId of mentionedIds) {
            mentionedActorIds.add(actorId);
            setActor(actors, usersById.get(actorId) ?? unknownActor(actorId, rawMessage.team));
        }

        const reactions = mapReactions(rawMessage);
        for (const reaction of reactions) {
            reactionCount += reaction.count;
            for (const actorId of reaction.actor_ids) {
                setActor(actors, usersById.get(actorId) ?? unknownActor(actorId, rawMessage.team));
            }
        }

        const files = mapFiles(rawMessage);
        fileCount += files.length;
        for (const file of files) {
            if (file.actor_id) {
                setActor(actors, usersById.get(file.actor_id) ?? unknownActor(file.actor_id, rawMessage.team));
            }
        }

        latestTimestamp = Math.max(latestTimestamp, Number(rawMessage.edited?.ts ?? rawMessage.ts));

        if (rawMessage.edited?.user) {
            setActor(actors, usersById.get(rawMessage.edited.user) ?? unknownActor(rawMessage.edited.user, rawMessage.team));
        }

        const links = mapLinks(rawMessage);

        return withoutUndefined({
            id: `${channel.id}-${rawMessage.ts}`,
            ts: rawMessage.ts,
            thread_ts: rawMessage.thread_ts ?? rootTs,
            created_at: slackTsToIso(rawMessage.ts),
            updated_at: rawMessage.edited?.ts ? slackTsToIso(rawMessage.edited.ts) : undefined,
            edited_by_id: rawMessage.edited?.user,
            client_msg_id: rawMessage.client_msg_id,
            author_id: author.id,
            parent_author_id: rawMessage.parent_user_id,
            type: rawMessage.type ?? 'message',
            subtype: rawMessage.subtype,
            text: rawMessage.text ?? '',
            blocks: rawMessage.blocks,
            attachments: rawMessage.attachments,
            reactions: reactions.length > 0 ? reactions : undefined,
            files: files.length > 0 ? files : undefined,
            links: links.length > 0 ? links : undefined,
            mentioned_actor_ids: mentionedIds.length > 0 ? mentionedIds : undefined,
            bot_id: rawMessage.bot_id,
            app_id: rawMessage.app_id
        });
    });

    const actorIds = Object.keys(actors).sort();
    const createdAt = slackTsToIso(rootMessage.ts);
    const updatedAt = slackTsToIso(String(latestTimestamp));

    return {
        id: `${channel.id}-${rootTs}`,
        team_id: teamId,
        channel,
        root_ts: rootTs,
        created_at: createdAt,
        updated_at: updatedAt,
        actors,
        facets: {
            channel_id: channel.id,
            root_author_id: mappedMessages[0]!.author_id,
            author_ids: Array.from(authorIds).sort(),
            actor_ids: actorIds,
            mentioned_actor_ids: Array.from(mentionedActorIds).sort(),
            has_replies: mappedMessages.length > 1,
            has_files: fileCount > 0,
            has_reactions: reactionCount > 0
        },
        counts: {
            messages: mappedMessages.length,
            replies: Math.max(mappedMessages.length - 1, 0),
            actors: actorIds.length,
            files: fileCount,
            reactions: reactionCount
        },
        messages: mappedMessages
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
    const name = firstNonEmpty(user.profile?.display_name, user.profile?.real_name, user.real_name, user.name, user.id) ?? 'unknown';

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
        updated_at: user.updated ? slackSecondsToIso(user.updated) : undefined
    });
}

function mapChannel(channel: RawSlackChannel): SlackChannel {
    return withoutUndefined({
        id: channel.id,
        team_id: channel.context_team_id ?? channel.team_id,
        type: getChannelType(channel),
        name: channel.name,
        name_normalized: channel.name_normalized,
        is_private: channel.is_private ?? false,
        is_archived: channel.is_archived ?? false,
        is_shared: channel.is_shared,
        is_org_shared: channel.is_org_shared,
        is_ext_shared: channel.is_ext_shared,
        is_general: channel.is_general,
        creator_id: channel.creator,
        num_members: channel.num_members,
        previous_names: channel.previous_names && channel.previous_names.length > 0 ? channel.previous_names : undefined,
        created_at: channel.created ? slackSecondsToIso(channel.created) : undefined,
        updated_at: channel.updated ? new Date(channel.updated).toISOString() : undefined,
        topic: mapConversationText(channel.topic),
        purpose: mapConversationText(channel.purpose)
    });
}

function getChannelType(channel: RawSlackChannel): SlackChannel['type'] {
    if (channel.is_im) {
        return 'im';
    }
    if (channel.is_mpim) {
        return 'mpim';
    }
    if (channel.is_private || channel.is_group) {
        return 'private_channel';
    }
    if (channel.is_channel) {
        return 'public_channel';
    }
    return 'unknown';
}

function mapConversationText(
    value:
        | {
              value?: string;
              creator?: string;
              last_set?: number;
          }
        | undefined
): SlackChannel['topic'] {
    if (!value || !value.value) {
        return undefined;
    }

    return withoutUndefined({
        value: value.value,
        creator_id: value.creator || undefined,
        updated_at: value.last_set ? slackSecondsToIso(value.last_set) : undefined
    });
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
            avatar_url: message.bot_profile.icons?.image_72 ?? message.bot_profile.icons?.image_48 ?? message.bot_profile.icons?.image_36,
            updated_at: message.bot_profile.updated ? slackSecondsToIso(message.bot_profile.updated) : undefined
        });
    }

    return unknownActor(authorId, message.team);
}

function unknownActor(id: string, teamId?: string): SlackActor {
    return withoutUndefined({
        id,
        kind: 'unknown',
        name: id,
        team_id: teamId
    });
}

function setActor(actors: Record<string, SlackActor>, actor: SlackActor): void {
    const existing = actors[actor.id];
    if (!existing || existing.kind === 'unknown') {
        actors[actor.id] = actor;
    }
}

function mapReactions(message: RawSlackMessage): z.infer<typeof SlackReactionSchema>[] {
    return (
        message.reactions
            ?.filter((reaction) => reaction.name)
            .map((reaction) => ({
                name: reaction.name!,
                count: reaction.count ?? reaction.users?.length ?? 0,
                actor_ids: [...new Set(reaction.users ?? [])].sort()
            })) ?? []
    );
}

function mapFiles(message: RawSlackMessage): SlackFile[] {
    return (
        message.files
            ?.filter((file) => file.id)
            .map((file) =>
                withoutUndefined({
                    id: file.id!,
                    name: file.name,
                    title: file.title,
                    mimetype: file.mimetype,
                    filetype: file.filetype,
                    url_private: file.url_private,
                    permalink: file.permalink,
                    size: file.size,
                    created_at: file.created ? slackSecondsToIso(file.created) : undefined,
                    actor_id: file.user
                })
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
            links.set(url, withoutUndefined({ url, label: match[2] }));
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
    if (record['type'] === 'user' && typeof record['user_id'] === 'string') {
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
    return new Date(Number(ts) * 1000).toISOString();
}

function slackSecondsToIso(seconds: number): string {
    return new Date(seconds * 1000).toISOString();
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
    return values.find((value) => value && value.trim().length > 0);
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

export type NangoSyncLocal = Parameters<(typeof sync)['exec']>[0];
export default sync;
