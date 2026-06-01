import { createSync, type ProxyConfiguration } from 'nango';
import { z } from 'zod';
import { BatchWriter } from '../../syncs/batch-writer.js';
import { createBrainSink } from '../../syncs/brain-sink.js';
import { defineCompanyBrainRecord } from '../../syncs/company-brain-record.js';

const PAGE_SIZE = 100;
const PROXY_RETRIES = 3;
const CHECKPOINT_OVERLAP_MS = 1000;
const GITHUB_ORGANIZATION = 'onfabric';

const GITHUB_API_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const GitHubActorRefSchema = z.object({
  username: z.string(),
});

const GitHubCommitSchema = z.object({
  title: z.string(),
  message: z.string().optional(),
  authored_at: z.string().optional(),
  author: GitHubActorRefSchema,
  url: z.string().optional(),
});

const GitHubReviewSchema = z.object({
  reviewer: GitHubActorRefSchema,
  state: z.string(),
  submitted_at: z.string().optional(),
  body: z.string().optional(),
  url: z.string().optional(),
});

const GitHubCommentSchema = z.object({
  kind: z.enum(['discussion', 'code']),
  author: GitHubActorRefSchema,
  created_at: z.string(),
  updated_at: z.string().optional(),
  body: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
  url: z.string().optional(),
});

const GitHubPullRequestSchema = defineCompanyBrainRecord({
  repository: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().optional(),
  url: z.string(),
  state: z.string(),
  status: z.enum(['open', 'closed', 'merged']),
  draft: z.boolean(),
  author: GitHubActorRefSchema,
  reviewers: z.array(GitHubActorRefSchema).optional(),
  requested_reviewers: z.array(GitHubActorRefSchema).optional(),
  assignees: z.array(GitHubActorRefSchema).optional(),
  labels: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  source_branch: z.string(),
  target_branch: z.string(),
  closed_at: z.string().optional(),
  merged_at: z.string().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changed_files: z.number().optional(),
  commits: z.array(GitHubCommitSchema),
  reviews: z.array(GitHubReviewSchema),
  comments: z.array(GitHubCommentSchema),
});

const GitHubPullRequestDraftSchema = GitHubPullRequestSchema.omit({ body: true });

const MetadataSchema = z.object({
  repos: z
    .array(z.string())
    .optional()
    .describe(
      `Optional subset of ${GITHUB_ORGANIZATION} repositories in owner/repo format. If omitted, all accessible ${GITHUB_ORGANIZATION} repositories are listed`,
    ),
  state: z.enum(['open', 'closed', 'all']).optional().describe('Pull request state to sync'),
});

const CheckpointSchema = z.object({
  repositoriesLastSyncDateJson: z.string(),
  lastSyncDate: z.string(),
});

const RawGitHubUserSchema = z.object({
  login: z.string(),
  name: z.string().nullable().optional(),
  html_url: z.string().optional(),
});

const RawGitHubTeamSchema = z.object({
  name: z.string().nullable().optional(),
  slug: z.string().optional(),
  html_url: z.string().optional(),
});

const RawGitHubLabelSchema = z.object({
  name: z.string(),
});

const RawGitHubMilestoneSchema = z.object({
  title: z.string(),
});

const RawGitHubBranchSchema = z.object({
  ref: z.string(),
  label: z.string().optional(),
  sha: z.string().optional(),
});

const RawPullRequestSchema = z.object({
  number: z.number(),
  state: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  user: RawGitHubUserSchema.nullable().optional(),
  assignees: z.array(RawGitHubUserSchema).optional().default([]),
  requested_reviewers: z.array(RawGitHubUserSchema).optional().default([]),
  requested_teams: z.array(RawGitHubTeamSchema).optional().default([]),
  labels: z.array(RawGitHubLabelSchema).optional().default([]),
  milestone: RawGitHubMilestoneSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  merged_at: z.string().nullable().optional(),
  head: RawGitHubBranchSchema,
  base: RawGitHubBranchSchema,
  draft: z.boolean().optional(),
  html_url: z.string(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  changed_files: z.number().optional(),
  merged: z.boolean().optional(),
});

const RawRepositorySchema = z.object({
  full_name: z.string().optional(),
  name: z.string(),
  owner: z.object({
    login: z.string(),
  }),
});

const RawCommitSchema = z.object({
  html_url: z.string().optional(),
  commit: z.object({
    message: z.string().optional(),
    author: z
      .object({
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        date: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  author: RawGitHubUserSchema.nullable().optional(),
});

const RawIssueCommentSchema = z.object({
  body: z.string().nullable().optional(),
  user: RawGitHubUserSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
  html_url: z.string().optional(),
});

const RawReviewSchema = z.object({
  body: z.string().nullable().optional(),
  user: RawGitHubUserSchema.nullable().optional(),
  state: z.string(),
  submitted_at: z.string().nullable().optional(),
  html_url: z.string().optional(),
});

const RawReviewCommentSchema = z.object({
  body: z.string().nullable().optional(),
  user: RawGitHubUserSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  line: z.number().nullable().optional(),
  original_line: z.number().nullable().optional(),
  html_url: z.string().optional(),
});

const RawRequestedReviewersSchema = z.object({
  users: z.array(RawGitHubUserSchema).optional().default([]),
  teams: z.array(RawGitHubTeamSchema).optional().default([]),
});

type GitHubActorRef = z.infer<typeof GitHubActorRefSchema>;
type GitHubComment = z.infer<typeof GitHubCommentSchema>;
type GitHubCommit = z.infer<typeof GitHubCommitSchema>;
type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;
type GitHubPullRequestDraft = z.infer<typeof GitHubPullRequestDraftSchema>;
type GitHubReview = z.infer<typeof GitHubReviewSchema>;
type Metadata = z.infer<typeof MetadataSchema>;
type RawGitHubTeam = z.infer<typeof RawGitHubTeamSchema>;
type RawGitHubUser = z.infer<typeof RawGitHubUserSchema>;
type RawPullRequest = z.infer<typeof RawPullRequestSchema>;

const sync = createSync({
  description:
    'Sync GitHub pull requests as self-contained records with repository context, reviewers, commits, comments, and review activity',
  version: '1.0.0',
  endpoints: [{ method: 'POST', path: '/syncs/pull-requests', group: 'Pull Requests' }],
  frequency: 'every hour',
  autoStart: true,
  scopes: ['repo'],
  metadata: MetadataSchema,
  checkpoint: CheckpointSchema,

  models: {
    GitHubPullRequest: GitHubPullRequestSchema,
  },

  exec: async (nango) => {
    const metadata = parseOptional(MetadataSchema, await nango.getMetadata());
    const checkpoint = parseOptional(CheckpointSchema, await nango.getCheckpoint());
    const repositoriesLastSyncDate = parseRepositoriesLastSyncDate(
      checkpoint?.repositoriesLastSyncDateJson,
    );
    const updatedRepositoriesLastSyncDate = { ...repositoriesLastSyncDate };
    const repositories = await getRepositoriesInScope(nango, metadata);
    const writer = new BatchWriter<GitHubPullRequest>({
      nango,
      model: 'GitHubPullRequest',
      batchSize: PAGE_SIZE,
      schema: GitHubPullRequestSchema,
      afterSave: createBrainSink(nango),
    });

    if (repositories.length === 0) {
      await nango.log(
        `No ${GITHUB_ORGANIZATION} GitHub repositories available for pull request sync`,
      );
      return;
    }

    for (const repoFullName of repositories) {
      const updatedAfter = repositoriesLastSyncDate[repoFullName];
      const nextCheckpoint = await processRepository(
        nango,
        writer,
        repoFullName,
        metadata?.state ?? 'all',
        updatedAfter,
      );

      if (nextCheckpoint) {
        updatedRepositoriesLastSyncDate[repoFullName] = nextCheckpoint;
        await nango.saveCheckpoint({
          repositoriesLastSyncDateJson: JSON.stringify(updatedRepositoriesLastSyncDate),
          lastSyncDate: new Date().toISOString(),
        });
      }
    }

    await nango.saveCheckpoint({
      repositoriesLastSyncDateJson: JSON.stringify(updatedRepositoriesLastSyncDate),
      lastSyncDate: new Date().toISOString(),
    });
  },
});

async function getRepositoriesInScope(
  nango: NangoSyncLocal,
  metadata: Metadata | undefined,
): Promise<string[]> {
  const configuredRepos = normalizeRepositoryNames(metadata?.repos ?? []);
  if (configuredRepos.length > 0) {
    const onfabricRepos = configuredRepos.filter(isOnfabricRepository);
    const ignoredRepos = configuredRepos.filter((repository) => !isOnfabricRepository(repository));

    if (ignoredRepos.length > 0) {
      await nango.log(
        `Ignoring non-${GITHUB_ORGANIZATION} GitHub repositories: ${ignoredRepos.join(', ')}`,
      );
    }

    return onfabricRepos;
  }

  const repositories: string[] = [];
  const proxyConfig = {
    endpoint: `/orgs/${GITHUB_ORGANIZATION}/repos`,
    headers: GITHUB_API_HEADERS,
    params: {
      type: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: PAGE_SIZE,
    },
    paginate: linkPagination(),
    retries: PROXY_RETRIES,
  } satisfies ProxyConfiguration;

  for await (const page of nango.paginate<unknown>(proxyConfig)) {
    for (const rawRepository of page) {
      const parsed = RawRepositorySchema.safeParse(rawRepository);
      if (!parsed.success) {
        continue;
      }

      repositories.push(parsed.data.full_name ?? `${parsed.data.owner.login}/${parsed.data.name}`);
    }
  }

  return normalizeRepositoryNames(repositories).filter(isOnfabricRepository);
}

async function processRepository(
  nango: NangoSyncLocal,
  writer: BatchWriter<GitHubPullRequest>,
  repoFullName: string,
  state: 'open' | 'closed' | 'all',
  updatedAfter: string | undefined,
): Promise<string | undefined> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  let latestPullRequestUpdate: string | undefined;
  let reachedCheckpointWindow = false;
  const proxyConfig = {
    endpoint: repoEndpoint(owner, repo, '/pulls'),
    headers: GITHUB_API_HEADERS,
    params: {
      state,
      sort: 'updated',
      direction: 'desc',
      per_page: PAGE_SIZE,
    },
    paginate: linkPagination(),
    retries: PROXY_RETRIES,
  } satisfies ProxyConfiguration;

  for await (const page of nango.paginate<unknown>(proxyConfig)) {
    const pullRequests: GitHubPullRequest[] = [];

    for (const rawPullRequest of page) {
      const pullRequest = RawPullRequestSchema.parse(rawPullRequest);

      if (!isNewerThanCheckpoint(pullRequest.updated_at, updatedAfter)) {
        reachedCheckpointWindow = true;
        break;
      }

      latestPullRequestUpdate = getLaterTimestamp(latestPullRequestUpdate, pullRequest.updated_at);
      pullRequests.push(await buildPullRequest(nango, repoFullName, owner, repo, pullRequest));
    }

    await writer.saveMany(pullRequests);
    await writer.flush();

    if (reachedCheckpointWindow) {
      break;
    }
  }

  return latestPullRequestUpdate ? toOverlappingCheckpoint(latestPullRequestUpdate) : undefined;
}

async function buildPullRequest(
  nango: NangoSyncLocal,
  repoFullName: string,
  owner: string,
  repo: string,
  pullRequest: RawPullRequest,
): Promise<GitHubPullRequest> {
  const details =
    (await fetchPullRequestDetails(nango, owner, repo, pullRequest.number)) ?? pullRequest;
  const commits = await fetchCommits(nango, owner, repo, pullRequest.number);
  const reviews = await fetchReviews(nango, owner, repo, pullRequest.number);
  const comments = [
    ...(await fetchIssueComments(nango, owner, repo, pullRequest.number)),
    ...(await fetchReviewComments(nango, owner, repo, pullRequest.number)),
  ].sort(compareComments);
  const requestedReviewers =
    (await fetchRequestedReviewers(nango, owner, repo, pullRequest.number)) ??
    uniqueActorRefs([
      ...details.requested_reviewers.map(mapUser).filter(isDefined),
      ...details.requested_teams.map(mapTeam).filter(isDefined),
    ]);
  const reviewers = uniqueActorRefs(reviews.map((review) => review.reviewer));
  const labels = uniqueStrings(details.labels.map((label) => label.name));
  const assignees = uniqueActorRefs(details.assignees.map(mapUser).filter(isDefined));
  const description = normalizeText(details.body);
  const status = pullRequestStatus(details);
  const updatedAt = latestIso([
    details.updated_at,
    ...comments.map((comment) => comment.updated_at ?? comment.created_at),
    ...reviews.map((review) => review.submitted_at),
    ...commits.map((commit) => commit.authored_at),
  ]);
  const record = GitHubPullRequestDraftSchema.parse(
    withoutUndefined({
      id: `${repoFullName}#${details.number}`,
      repository: repoFullName,
      number: details.number,
      title: details.title,
      description,
      url: details.html_url,
      state: details.state,
      status,
      draft: details.draft ?? false,
      author: mapUser(details.user) ?? unknownActor(),
      reviewers: reviewers.length > 0 ? reviewers : undefined,
      requested_reviewers: requestedReviewers.length > 0 ? requestedReviewers : undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
      labels: labels.length > 0 ? labels : undefined,
      milestone: details.milestone?.title,
      source_branch: branchName(details.head),
      target_branch: branchName(details.base),
      created_at: details.created_at,
      updated_at: updatedAt,
      closed_at: details.closed_at ?? undefined,
      merged_at: details.merged_at ?? undefined,
      additions: details.additions,
      deletions: details.deletions,
      changed_files: details.changed_files,
      commits,
      reviews,
      comments,
    }),
  );

  return GitHubPullRequestSchema.parse({
    ...record,
    body: renderPullRequestBody(record),
  });
}

async function fetchPullRequestDetails(
  nango: NangoSyncLocal,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<RawPullRequest | undefined> {
  try {
    const response = await nango.get({
      endpoint: repoEndpoint(owner, repo, `/pulls/${pullNumber}`),
      headers: GITHUB_API_HEADERS,
      retries: PROXY_RETRIES,
    });
    return RawPullRequestSchema.parse(response.data);
  } catch {
    return undefined;
  }
}

async function fetchCommits(
  nango: NangoSyncLocal,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubCommit[]> {
  const commits = await fetchPaginated(
    nango,
    {
      endpoint: repoEndpoint(owner, repo, `/pulls/${pullNumber}/commits`),
      headers: GITHUB_API_HEADERS,
      params: { per_page: PAGE_SIZE },
      paginate: linkPagination(),
      retries: PROXY_RETRIES,
    },
    RawCommitSchema,
  );

  return commits.map(mapCommit);
}

async function fetchIssueComments(
  nango: NangoSyncLocal,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubComment[]> {
  const comments = await fetchPaginated(
    nango,
    {
      endpoint: repoEndpoint(owner, repo, `/issues/${pullNumber}/comments`),
      headers: GITHUB_API_HEADERS,
      params: { per_page: PAGE_SIZE },
      paginate: linkPagination(),
      retries: PROXY_RETRIES,
    },
    RawIssueCommentSchema,
  );

  return comments
    .map((comment) =>
      withoutUndefined({
        kind: 'discussion' as const,
        author: mapUser(comment.user) ?? unknownActor(),
        created_at: comment.created_at,
        updated_at:
          comment.updated_at && comment.updated_at !== comment.created_at
            ? comment.updated_at
            : undefined,
        body: normalizeText(comment.body) ?? '',
        url: comment.html_url,
      }),
    )
    .filter((comment) => comment.body.length > 0);
}

async function fetchReviews(
  nango: NangoSyncLocal,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubReview[]> {
  const reviews = await fetchPaginated(
    nango,
    {
      endpoint: repoEndpoint(owner, repo, `/pulls/${pullNumber}/reviews`),
      headers: GITHUB_API_HEADERS,
      params: { per_page: PAGE_SIZE },
      paginate: linkPagination(),
      retries: PROXY_RETRIES,
    },
    RawReviewSchema,
  );

  return reviews.map((review) =>
    withoutUndefined({
      reviewer: mapUser(review.user) ?? unknownActor(),
      state: review.state,
      submitted_at: review.submitted_at ?? undefined,
      body: normalizeText(review.body),
      url: review.html_url,
    }),
  );
}

async function fetchReviewComments(
  nango: NangoSyncLocal,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubComment[]> {
  const comments = await fetchPaginated(
    nango,
    {
      endpoint: repoEndpoint(owner, repo, `/pulls/${pullNumber}/comments`),
      headers: GITHUB_API_HEADERS,
      params: { per_page: PAGE_SIZE },
      paginate: linkPagination(),
      retries: PROXY_RETRIES,
    },
    RawReviewCommentSchema,
  );

  return comments
    .map((comment) =>
      withoutUndefined({
        kind: 'code' as const,
        author: mapUser(comment.user) ?? unknownActor(),
        created_at: comment.created_at,
        updated_at:
          comment.updated_at && comment.updated_at !== comment.created_at
            ? comment.updated_at
            : undefined,
        body: normalizeText(comment.body) ?? '',
        path: comment.path ?? undefined,
        line: comment.line ?? comment.original_line ?? undefined,
        url: comment.html_url,
      }),
    )
    .filter((comment) => comment.body.length > 0);
}

async function fetchRequestedReviewers(
  nango: NangoSyncLocal,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubActorRef[] | undefined> {
  try {
    const response = await nango.get({
      endpoint: repoEndpoint(owner, repo, `/pulls/${pullNumber}/requested_reviewers`),
      headers: GITHUB_API_HEADERS,
      retries: PROXY_RETRIES,
    });
    const parsed = RawRequestedReviewersSchema.parse(response.data);
    return uniqueActorRefs([
      ...parsed.users.map(mapUser).filter(isDefined),
      ...parsed.teams.map(mapTeam).filter(isDefined),
    ]);
  } catch {
    return undefined;
  }
}

async function fetchPaginated<T>(
  nango: NangoSyncLocal,
  config: ProxyConfiguration,
  schema: z.ZodType<T>,
): Promise<T[]> {
  const values: T[] = [];

  try {
    for await (const page of nango.paginate<unknown>(config)) {
      for (const value of page) {
        const parsed = schema.safeParse(value);
        if (parsed.success) {
          values.push(parsed.data);
        }
      }
    }
  } catch {
    return values;
  }

  return values;
}

function renderPullRequestBody(pullRequest: GitHubPullRequestDraft): string {
  const lines = [
    `# Pull request ${pullRequest.repository}#${pullRequest.number}: ${pullRequest.title}`,
    '',
    `- Status: ${renderStatus(pullRequest)}`,
    `- Repository: ${pullRequest.repository}`,
    `- Author: ${renderActor(pullRequest.author)}`,
    `- Branch: ${pullRequest.source_branch} -> ${pullRequest.target_branch}`,
    `- Created: ${pullRequest.created_at}`,
    `- Last activity: ${pullRequest.updated_at}`,
    `- URL: ${pullRequest.url}`,
  ];

  if (pullRequest.merged_at) {
    lines.push(`- Merged: ${pullRequest.merged_at}`);
  } else if (pullRequest.closed_at) {
    lines.push(`- Closed: ${pullRequest.closed_at}`);
  }

  if (pullRequest.labels && pullRequest.labels.length > 0) {
    lines.push(`- Labels: ${pullRequest.labels.join(', ')}`);
  }

  if (pullRequest.assignees && pullRequest.assignees.length > 0) {
    lines.push(`- Assignees: ${pullRequest.assignees.map(renderActor).join(', ')}`);
  }

  if (pullRequest.reviewers && pullRequest.reviewers.length > 0) {
    lines.push(`- Reviewers: ${pullRequest.reviewers.map(renderActor).join(', ')}`);
  }

  if (pullRequest.requested_reviewers && pullRequest.requested_reviewers.length > 0) {
    lines.push(
      `- Requested reviewers: ${pullRequest.requested_reviewers.map(renderActor).join(', ')}`,
    );
  }

  if (pullRequest.milestone) {
    lines.push(`- Milestone: ${pullRequest.milestone}`);
  }

  if (
    pullRequest.changed_files !== undefined ||
    pullRequest.additions !== undefined ||
    pullRequest.deletions !== undefined
  ) {
    lines.push(
      `- Diff: ${renderCount(pullRequest.changed_files, 'file')} changed, +${pullRequest.additions ?? 0}/-${pullRequest.deletions ?? 0}`,
    );
  }

  lines.push('', '## Description', '', pullRequest.description ?? '(no description)');

  const events = pullRequestTimeline(pullRequest);
  if (events.length > 0) {
    lines.push('', '## Reviews and comments', '');
    for (const event of events) {
      lines.push(`### ${event.createdAt} - ${renderActor(event.actor)} - ${event.title}`);
      lines.push('');
      lines.push(event.body);
      if (event.url) {
        lines.push('');
        lines.push(`Link: ${event.url}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function pullRequestTimeline(pullRequest: GitHubPullRequestDraft): TimelineEvent[] {
  return [
    ...pullRequest.reviews
      .filter((review) => review.submitted_at)
      .map((review) => ({
        createdAt: review.submitted_at!,
        actor: review.reviewer,
        title: `Review ${formatReviewState(review.state)}`,
        body:
          review.body ??
          `${renderActor(review.reviewer)} marked this pull request ${formatReviewState(review.state)}.`,
        url: review.url,
      })),
    ...pullRequest.comments.map((comment) => ({
      createdAt: comment.created_at,
      actor: comment.author,
      title:
        comment.kind === 'code'
          ? `Code review comment${renderCodeLocation(comment)}`
          : 'Discussion comment',
      body: comment.body,
      url: comment.url,
    })),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

type TimelineEvent = {
  createdAt: string;
  actor: GitHubActorRef;
  title: string;
  body: string;
  url?: string | undefined;
};

function mapCommit(rawCommit: z.infer<typeof RawCommitSchema>): GitHubCommit {
  const rawMessage = normalizeText(rawCommit.commit.message) ?? '(no commit message)';
  const { title, message } = splitCommitMessage(rawMessage);

  return withoutUndefined({
    title,
    message,
    authored_at: rawCommit.commit.author?.date ?? undefined,
    author: mapCommitAuthor(rawCommit),
    url: rawCommit.html_url,
  });
}

function mapCommitAuthor(rawCommit: z.infer<typeof RawCommitSchema>): GitHubActorRef {
  const gitAuthor = rawCommit.commit.author;
  const user = mapUser(rawCommit.author);

  if (user) {
    return user;
  }

  return {
    username:
      firstNonEmpty(gitAuthor?.name ?? undefined, gitAuthor?.email ?? undefined) ?? 'unknown',
  };
}

function mapUser(user: RawGitHubUser | null | undefined): GitHubActorRef | undefined {
  if (!user) {
    return undefined;
  }

  return {
    username: user.login,
  };
}

function mapTeam(team: RawGitHubTeam): GitHubActorRef | undefined {
  const name = firstNonEmpty(team.name ?? undefined, team.slug);
  if (!name) {
    return undefined;
  }

  return {
    username: team.slug ?? name,
  };
}

function unknownActor(): GitHubActorRef {
  return { username: 'unknown' };
}

function renderStatus(pullRequest: Pick<GitHubPullRequestDraft, 'draft' | 'status'>): string {
  const parts: string[] = [pullRequest.status];
  if (pullRequest.draft) {
    parts.push('draft');
  }
  return parts.join(', ');
}

function renderActor(actor: GitHubActorRef): string {
  return actor.username;
}

function renderCodeLocation(comment: GitHubComment): string {
  if (!comment.path) {
    return '';
  }

  return comment.line ? ` on ${comment.path}:${comment.line}` : ` on ${comment.path}`;
}

function renderCount(value: number | undefined, label: string): string {
  const count = value ?? 0;
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function formatReviewState(state: string): string {
  return state.toLowerCase().replace(/_/g, ' ');
}

function splitCommitMessage(message: string): { title: string; message?: string } {
  const [firstLine, ...rest] = message.split(/\r?\n/);
  const body = rest.join('\n').trim();
  const title = firstLine?.trim() || '(no commit title)';

  return body.length > 0 ? { title, message: body } : { title };
}

function pullRequestStatus(pullRequest: RawPullRequest): 'open' | 'closed' | 'merged' {
  if (pullRequest.merged || pullRequest.merged_at) {
    return 'merged';
  }
  return pullRequest.state === 'closed' ? 'closed' : 'open';
}

function branchName(branch: z.infer<typeof RawGitHubBranchSchema>): string {
  return firstNonEmpty(branch.label, branch.ref, branch.sha) ?? 'unknown';
}

function linkPagination(): NonNullable<ProxyConfiguration['paginate']> {
  return {
    type: 'link',
    limit_name_in_request: 'per_page',
    limit: PAGE_SIZE,
    link_rel_in_response_header: 'next',
  };
}

function repoEndpoint(owner: string, repo: string, suffix: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

function parseRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const [owner, repo, ...rest] = repoFullName.split('/');
  if (!owner || !repo || rest.length > 0) {
    throw new Error(`Invalid GitHub repository "${repoFullName}". Expected owner/repo.`);
  }

  return { owner, repo };
}

function normalizeRepositoryNames(repositories: string[]): string[] {
  return uniqueStrings(
    repositories
      .map((repository) => repository.trim())
      .filter((repository) => repository.length > 0),
  );
}

function isOnfabricRepository(repository: string): boolean {
  return repository.toLowerCase().startsWith(`${GITHUB_ORGANIZATION}/`);
}

function parseRepositoriesLastSyncDate(value: string | undefined): Record<string, string> {
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

function latestIso(timestamps: Array<string | undefined>): string {
  const sorted = timestamps.filter(isDefined).sort((a, b) => Date.parse(a) - Date.parse(b));

  return sorted.at(-1) ?? new Date(0).toISOString();
}

function compareComments(a: GitHubComment, b: GitHubComment): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

function getLaterTimestamp(current: string | undefined, candidate: string): string {
  if (!current) {
    return candidate;
  }

  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function isNewerThanCheckpoint(timestamp: string, checkpoint: string | undefined): boolean {
  if (!checkpoint) {
    return true;
  }

  return Date.parse(timestamp) > Date.parse(checkpoint);
}

function toOverlappingCheckpoint(timestamp: string): string {
  return new Date(Date.parse(timestamp) - CHECKPOINT_OVERLAP_MS).toISOString();
}

function uniqueActorRefs(actors: GitHubActorRef[]): GitHubActorRef[] {
  const byKey = new Map<string, GitHubActorRef>();

  for (const actor of actors) {
    byKey.set(actorKey(actor), actor);
  }

  return [...byKey.values()].sort((a, b) => a.username.localeCompare(b.username));
}

function actorKey(actor: GitHubActorRef): string {
  return actor.username.toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

function normalizeText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0);
}

function parseOptional<T>(schema: z.ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

export type NangoSyncLocal = Parameters<(typeof sync)['exec']>[0];
export default sync;
