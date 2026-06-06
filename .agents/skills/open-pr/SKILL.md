---
name: open-pr
description: Use this repo-local skill when asked to open, prepare, publish, or shepherd a pull request in Company Brain. Never merge a PR unless the user explicitly asks for that merge. PRs opened with this skill should be shepherded through pre-merge checks, and through post-merge CI only after a user or another actor merges them.
---

# Open PR

Use this skill to finish work by opening a pull request and shepherding it through pre-merge checks. Shepherding is mandatory whenever this skill is invoked, but it does not authorize merging.

## Ground Rules

- Preserve user changes. Do not stage, rewrite, revert, or clean up unrelated work.
- Use non-interactive git and GitHub CLI commands.
- Never push directly to `main`.
- Never merge a PR unless the user explicitly asks you to merge that specific PR. Passing checks, clean mergeability, this skill being invoked, or the word "shepherd" are not merge approval.
- Keep PRs narrow. If post-merge CI fails, fix only the failure caused by the merged PR or the smallest clear compatibility issue exposed by it.

## Write The PR Description

Write the PR body so someone uninvolved can quickly understand what changed, why it changed, and what decisions matter for review.

- Start with a concise explanation of the change and its purpose.
- Include key decisions, tradeoffs, risks, or follow-up context only when they help a reviewer.
- Avoid formulaic three-bullet summaries. Use bullets only when they make the change easier to scan.
- Keep the body as short as the change allows. Do not pad it with implementation trivia, command output, or generic checklist text.
- Do not include routine local validation command lists, such as a "Validation run locally" section. Mention validation only when there is an unusual caveat, failed command, skipped check, or other reviewer-relevant context.

## Mandatory Shepherding

After opening a PR, do not treat the task as complete until one of these is true:

- Pre-merge checks pass and the PR is still open, so the user has been told it is ready for review or merge.
- The user explicitly asks you to wait for a human merge; arrange a follow-up in the current thread to continue after merge.
- The PR is merged by the user or another actor and post-merge CI for the merged commit passes.
- The PR is closed without merge and the user has been told.
- Post-merge CI fails and a repair PR has been opened.
- GitHub state or logs are unavailable or ambiguous enough that user input is required.

If waiting for review, a user-approved merge, or CI would exceed the current turn, arrange a follow-up in the current thread and resume shepherding later. Keep enough state in the follow-up prompt to continue: PR URL, PR number, branch, base branch, current status, and the next check to run.

Poll the PR with GitHub CLI, for example:

```bash
gh pr view "$PR_NUMBER" --json number,state,mergedAt,mergeCommit,headRefName,baseRefName,url
```

When the PR is still open and checks are still pending, wait and poll again. When checks pass, report that the PR is ready and stop unless the user has explicitly asked you to keep watching. When it is closed without merge, report that and stop.

## Explicit Merge Approval Required

Do not run `gh pr merge`, use auto-merge, press merge buttons through browser automation, or otherwise cause a PR to merge unless the user explicitly asks you to merge that specific PR. If a PR is mergeable and checks pass, report that state to the user and stop or schedule a follow-up. If the user later asks you to merge, then merge using the repository's normal merge style and continue with post-merge CI shepherding.

## Find The Merged Commit

When the PR is merged by an approved merge action, the user, or another actor, identify the exact commit on the base branch whose CI should be checked.

Prefer the PR merge commit from GitHub:

```bash
gh pr view "$PR_NUMBER" --json mergeCommit --jq '.mergeCommit.oid'
```

If that is unavailable, fetch the base branch and use GitHub metadata plus the latest base branch history to identify the commit associated with the merged PR. Be careful with squash and rebase merges. Do not assume the latest `origin/main` commit is the PR's merged commit if other commits may have landed after it.

## Poll Post-Merge CI

Poll GitHub Actions and checks for the merged commit SHA on the base branch. Inspect `.github/workflows` when needed to understand expected workflows.

Useful commands:

```bash
gh run list --branch "$BASE_BRANCH" --commit "$MERGED_SHA" --json databaseId,status,conclusion,name,workflowName,event,headSha,url,createdAt
gh run watch "$RUN_ID" --exit-status
gh run view "$RUN_ID" --log-failed
```

Wait until relevant runs for the merged SHA are complete. If all relevant post-merge checks pass, tell the user the PR merged and CI passed, then stop.

If the failure is obviously transient infrastructure, rerun once when safe:

```bash
gh run rerun "$RUN_ID"
```

If the rerun passes, report success and stop. If it fails again, continue with repair.

## Repair A Failed Merge

When post-merge CI fails because of the merged PR or a clear issue exposed by it:

1. Fetch the latest base branch.
2. Create a new branch from the current base branch.
3. Read the failed logs and reproduce locally when practical.
4. Make the smallest safe fix.
5. Push and open a repair PR.
6. Link the original PR and failed run URL in the repair PR body.
7. Shepherd the repair PR too, but do not create an endless chain of repair PRs. If the repair PR's post-merge CI also fails and the next fix is not obvious and narrow, report the failure and ask for direction.

If logs are missing, permission is denied, the failure does not point to a code fix, or the likely fix would be broad, stop and explain what is known instead of guessing.
