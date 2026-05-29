# Nango Integrations

This folder contains the Nango function implementations for Company Brain.

## Local Setup

This project uses Bun as its package manager and test runner. The Nango CLI is pinned in `devDependencies`, so you do not need to install it globally.

```sh
bun install
cp .env.example .env
```

Bun resolves the local CLI from `node_modules/.bin`. The package scripts below invoke it with `bun run --bun nango <command>`. Fill `.env` with the Nango API keys for the target environment. When deploying to a self-hosted/local Nango server, set `NANGO_HOSTPORT` to that server URL.

## Commands

```sh
bun run compile
bun run dev
bun run test
bun run dryrun <sync-name> <connection-id> -e dev --integration-id slack --validate
bun run deploy dev --integration slack
```

The Nango server is not started from this folder. The CLI compiles these functions locally and deploys them to the Nango server configured by the environment variables.
