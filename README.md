# Company Brain

Self-hostable Company Brain experiment: Nango collects records from workplace
tools, the brain service normalizes/searches them, and the dashboard lets you
inspect what is flowing in.

## Local First

Start locally before thinking about AWS, domains, or GitHub Actions.

```bash
git clone --recurse-submodules https://github.com/onfabric/company-brain
cd company-brain
bun install
bun run company-brain local setup
```

Local URLs:

- Brain dashboard: http://localhost:3010/dashboard
- Nango dashboard/login and API keys: http://localhost:3003

After the stack is running, create or sign in to the local Nango dashboard and
copy the dev API key from Environment Settings.

`local setup` starts Docker Compose by default. Use
`bun run company-brain local setup --skip-start` if you only want to generate
the local env files. Run `bun run company-brain local setup` again whenever you
want to start or restart the local stack.

## Create Integrations

Choose and create the Company Brain integrations you want in local Nango:

```bash
bun run company-brain nango integrations
```

The CLI prompts for which integrations to install, then asks for the local Nango
dev API key and OAuth app credentials for only those integrations. You can also
pass the local Nango dev API key directly:

```bash
bun run company-brain nango integrations --nango-api-key <dev-api-key>
```

Use this callback URL for local OAuth apps:

```txt
http://localhost:3003/oauth/callback
```

For non-interactive use, pass the integrations explicitly:

```bash
bun run company-brain nango integrations --only notion,slack
```

This step only creates the selected integrations. Syncs are deployed separately
after you create the OAuth connections.

## Connect Sources

In the Nango dashboard, create OAuth connections only for the sources you want
to try first. Suggested connection IDs:

- `notion/notion`
- `slack/slack`
- `github/github`
- `google-mail/gmail`

`agent-conversations/local-agent-sync` is bootstrapped automatically.

Circleback MCP is a manual Nango integration. If you want to ingest Circleback
meetings, create and manage the `circleback-mcp` integration and its connection
in Nango yourself, then deploy that sync explicitly.

## Deploy Syncs

After you create the OAuth connections in Nango, deploy syncs for every
integration you installed:

```bash
bun run company-brain nango syncs
```

For non-interactive use or manual overrides:

```bash
bun run company-brain nango syncs --only notion,slack
```

`--only` overrides the installed-integration list and accepts numbers such as
`--only 1,2`. `--all` deploys every sync, including manually managed syncs.

Available sync integrations are:

- `notion` — Notion pages
- `slack` — Slack threads
- `github` — GitHub pull requests
- `google-mail` — Gmail threads
- `agent-conversations` — local agent conversations

Manual sync integrations are:

- `circleback-mcp` — Circleback meetings

## Check Local Setup

```bash
bun run company-brain local doctor
```

The doctor checks Docker, service health, local env files, Nango API key
configuration, and selected sync configuration.

## CLI

The primary local entrypoint is the Parsh CLI:

```bash
bun run company-brain --help
bun run company-brain local setup
bun run company-brain nango integrations
bun run company-brain nango syncs
```

## Contributing

See [AGENTS.md](./AGENTS.md) for contributor and agent guidance.

## Agent Sync Installer Smoke Test

The release installer only installs the `company-brain-agent-sync` CLI. After
installing, run:

```bash
company-brain-agent-sync init
```

`init` writes the required local config first, then installs and starts the
macOS LaunchAgent. If required config is still missing, the LaunchAgent is not
installed.

On macOS, run this before publishing an agent-sync release:

```bash
scripts/smoke-test-agent-sync-installer.sh
```

It builds local release assets, installs from those assets into a temporary home
directory, skips LaunchAgent registration, and verifies the installed binary can
read a complete configuration. Set `COMPANY_BRAIN_AGENT_SYNC_SMOKE_KEEP=1` to
keep the temporary directory for inspection.
