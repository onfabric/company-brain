import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { NangoSyncMock } from '../../test-support/nango-sync-mock.js';
import createSync, { type NangoSyncLocal } from '../syncs/pull-requests.js';

const GitHubPullRequestModel = createSync.models.GitHubPullRequest;

function asNango(mock: NangoSyncMock): NangoSyncLocal {
  return mock as unknown as NangoSyncLocal;
}

describe('github pull request sync tests', () => {
  const createTestContext = (name = 'pull-requests') => {
    const nangoMock = new NangoSyncMock({
      dirname: __dirname,
      name,
    });

    return {
      nangoMock: asNango(nangoMock),
      batchSaveSpy: spyOn(nangoMock, 'batchSave'),
    };
  };

  afterEach(() => {
    mock.clearAllMocks();
    mock.restore();
  });

  it('should build readable GitHub pull request records', async () => {
    const { nangoMock, batchSaveSpy } = createTestContext();

    await createSync.exec(nangoMock);

    const savedPullRequests = batchSaveSpy.mock.calls.flatMap((call) =>
      call[1] === 'GitHubPullRequest' ? call[0] : [],
    );
    const [pullRequest] = JSON.parse(JSON.stringify(savedPullRequests));

    expect(savedPullRequests).toHaveLength(1);
    expectGitHubPullRequestSchema(pullRequest);
    expect(pullRequest).toMatchObject({
      id: 'acme/widgets#42',
      repository: 'acme/widgets',
      number: 42,
      title: 'Add retrieval-aware PR records',
      description:
        'Sync pull requests into one embedding-friendly document.\n\nIncludes commits and review context.',
      status: 'open',
      author: { username: 'maya' },
      reviewers: [{ username: 'alex' }],
      assignees: [{ username: 'alex' }],
      labels: ['company-brain', 'integration'],
      milestone: 'Q4 knowledge sync',
      source_branch: 'maya:feature/github-pr-sync',
      target_branch: 'acme:main',
      additions: 124,
      deletions: 18,
      changed_files: 5,
      commits: [
        {
          title: 'Add GitHub PR sync',
          message: 'Hydrates commits and comments.',
          authored_at: '2025-11-03T10:12:00Z',
          author: { username: 'maya' },
        },
        {
          title: 'Render PR body for search',
          authored_at: '2025-11-03T10:40:00Z',
          author: { username: 'Alex Rivera' },
        },
      ],
      comments: [
        {
          kind: 'discussion',
          author: { username: 'sam' },
          body: 'Can we include commit titles for search?',
        },
        {
          kind: 'code',
          author: { username: 'priya' },
          body: 'This should include review comments too.',
          path: 'github/syncs/pull-requests.ts',
          line: 88,
        },
      ],
      reviews: [
        {
          reviewer: { username: 'alex' },
          state: 'APPROVED',
          body: 'Schema looks clean.',
        },
      ],
    });

    expect(pullRequest.requested_reviewers).toEqual([
      {
        username: 'sam',
      },
      {
        username: 'search-infra',
      },
    ]);
    expect(pullRequest.body.startsWith('# Pull request acme/widgets#42')).toBe(true);
    expect(
      pullRequest.body.includes('Sync pull requests into one embedding-friendly document.'),
    ).toBe(true);
    expect(pullRequest.body.includes('## Commits')).toBe(false);
    expect(pullRequest.body.includes('Add GitHub PR sync')).toBe(false);
    expect(pullRequest.body.includes('Hydrates commits and comments.')).toBe(false);
    expect(pullRequest.body.includes('Review approved')).toBe(true);
    expect(
      pullRequest.body.includes('Code review comment on github/syncs/pull-requests.ts:88'),
    ).toBe(true);
    expect(pullRequest.body.includes('Can we include commit titles for search?')).toBe(true);
    expect(pullRequest.body.includes('- Diff: 5 files changed, +124/-18')).toBe(true);

    const nestedJson = JSON.stringify({
      commits: pullRequest.commits,
      reviews: pullRequest.reviews,
      comments: pullRequest.comments,
    });
    expect(nestedJson.includes('"id"')).toBe(false);
    expect(nestedJson.includes('node_id')).toBe(false);
    expect(nestedJson.includes('diff_hunk')).toBe(false);
    expect(nestedJson.includes('commit_id')).toBe(false);
    expect('raw' in pullRequest).toBe(false);
    expect('head' in pullRequest).toBe(false);
    expect('base' in pullRequest).toBe(false);
  });
});

function expectGitHubPullRequestSchema(value: unknown): void {
  const parsed = GitHubPullRequestModel.parse(value);
  expect(parsed).toStrictEqual(value as typeof parsed);
}
