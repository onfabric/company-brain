# Nango Integrations

This folder contains the Nango function implementations for Company Brain.

## Local Setup

This project uses Bun as its package manager and test runner. The Nango CLI is pinned in `devDependencies`, so you do not need to install it globally. The published CLI still requires Node.js because its executable runs with `node` and the package declares a Node engine.

```sh
bun install
cp .env.example .env
```

Bun resolves the local CLI from `node_modules/.bin`. Use `bun run nango <command>` for direct CLI commands, or the package scripts below for common tasks. Fill `.env` with the Nango API keys for the target environment. When deploying to a self-hosted/local Nango server, set `NANGO_HOSTPORT` to that server URL.

## Commands

```sh
bun run compile
bun run test
bun run nango dryrun <sync-name> <connection-id> -e dev --integration-id slack --validate
bun run nango deploy dev --integration slack
```

The Nango server is not started from this folder. The CLI compiles these functions locally and deploys them to the Nango server configured by the environment variables.
