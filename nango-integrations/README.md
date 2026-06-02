# Nango Integrations

This folder contains the Nango function implementations for Company Brain.

## Local Setup

This project uses Bun as its package manager and test runner. The Nango CLI is pinned in `devDependencies`, so you do not need to install it globally.

```sh
bun install
cp .env.example .env
```

Bun resolves the local CLI from `node_modules/.bin`; do not install `nango` globally. The package scripts below invoke the pinned devDependency through `bun run nango <command>`, default `NANGO_HOSTPORT` to `http://localhost:3003`, ignore CLI self-upgrade prompts, and disable automatic package/dependency updates. Fill `.env` with the Nango API keys for the local environment.

## Commands

```sh
bun run compile
bun run dev
bun run test
bun run dryrun <sync-name> <connection-id> -e dev --integration-id slack --validate
bun run deploy dev --integration slack
bun run bootstrap:integrations dev
bun run bootstrap:connections dev
bun run check:connections dev
```

The Nango server is not started from this folder. The CLI compiles these functions locally and deploys them to the Nango server configured by the environment variables.

## Integration Bootstrap

`bun run bootstrap:integrations dev` creates the Nango integrations used by the Company Brain syncs if they do not already exist. Re-run with `--update-existing` to repair display names, webhook forwarding, client IDs, scopes, and missing Circleback MCP OAuth registration on existing integrations.

`bun run bootstrap:connections dev` creates non-OAuth connections that CI can safely provision. It currently creates or updates `agent-conversations/local-agent-sync` with `credentials.type = "NONE"` and connection metadata `{ "webhookSecret": "..." }`.

Circleback uses dynamic MCP OAuth registration. Bootstrap creates it through Nango's v1 integration API so Nango registers the MCP OAuth client the same way dashboard creation does.

Deploy order matters on a fresh environment:

1. Run `bun run bootstrap:integrations dev --update-existing`.
2. Run `bun run bootstrap:connections dev`.
3. Create one OAuth/MCP dashboard connection for each integration: `notion`, `slack`, `github`, and `circleback-mcp`. Nango may assign generated UUID connection IDs for these manual connections.
4. Run `bun run check:connections dev`.
5. Run `bun run deploy dev`.

On a fresh hosted `dev` environment, the first CD run deploys Nango and then stops before bootstrapping integrations when the repository secret `NANGO_SECRET_KEY_DEV` is missing. Sign up in the Nango dashboard, copy the generated `dev` API key, add it as the repository secret `NANGO_SECRET_KEY_DEV`, and rerun CD.

After that, CD bootstraps integrations and non-OAuth connections, then intentionally stops before deploying syncs while required OAuth/MCP connections are missing. Create the dashboard connections for `notion`, `slack`, `github`, and `circleback-mcp`, then rerun CD.

Required environment:

```sh
NANGO_HOSTPORT=https://nango-dev.onfabric.io
NANGO_SECRET_KEY_DEV=...
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
GH_OAUTH_CLIENT_ID=...
GH_OAUTH_CLIENT_SECRET=...
AGENT_SYNC_WEBHOOK_SECRET=...
```

Scopes default to the lists below. Override them with GitHub Actions variables `SLACK_SCOPES` and `GH_OAUTH_SCOPES` when needed.

The connection gate checks configured connection IDs first, then accepts any existing dashboard connection for the OAuth/MCP integrations. Set `NOTION_CONNECTION_ID`, `SLACK_CONNECTION_ID`, `GH_CONNECTION_ID`, or `CIRCLEBACK_MCP_CONNECTION_ID` only when you want the gate to prefer a specific manual connection. The `agent-conversations` connection is provisioned by CI and defaults to `local-agent-sync`; override it with `AGENT_CONVERSATIONS_CONNECTION_ID` only if the webhook sender uses a different connection ID.

Slack is configured with:

```txt
channels:read,channels:history,channels:join,groups:read,groups:history,im:read,im:history,mpim:read,mpim:history,users:read,users:read.email
```

GitHub is configured with:

```txt
public_repo,read:org,read:user,repo,user:email,user
```
