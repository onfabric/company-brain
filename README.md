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
bun run company-brain target local
bun run company-brain setup
```

Optionally install a repo-backed `company-brain` command:

```bash
scripts/install-company-brain-cli.sh
company-brain target local
company-brain setup
```

Local URLs:

- Brain dashboard: http://localhost:3010/
- Nango dashboard/login and API keys: http://localhost:3003

`setup` with the local target generates env files, starts Docker Compose by default, waits for
the stack to become healthy, then asks for the local Nango dev API key at the
end. Use `bun run company-brain setup --skip-start` if you only want to
generate local env files. Run `bun run company-brain resume` to restart
the local stack or save the Nango API key later.

## Cloud

Provision the hosted Company Brain stack on AWS:

```bash
bun run company-brain target cloud
bun run company-brain setup
```

`setup` with the cloud target provisions AWS infrastructure, deploys the containers, verifies
DNS/HTTPS, then asks for the hosted Nango dev API key at the end. If DNS or
certificate setup needs a pause, run this after making the requested changes:

```bash
bun run company-brain resume
```

Use `--target local` or `--target cloud` on any target-aware command to override
the saved target for one run:

```bash
bun run company-brain doctor --target cloud
```

## Add Integrations

Choose and create the Company Brain source integrations you want:

```bash
bun run company-brain add integrations
bun run company-brain add integrations --target cloud
```

The CLI prompts for which source integrations to install and for OAuth app
credentials for only those integrations. You can also pass the Nango dev API
key directly:

```bash
bun run company-brain add integrations --nango-secret-key <dev-api-key>
bun run company-brain add integrations --target cloud --nango-secret-key <dev-api-key>
```

Use this callback URL for local OAuth apps:

```txt
http://localhost:3003/oauth/callback
```

For non-interactive use, pass the integrations explicitly:

```bash
bun run company-brain add integrations --only notion,slack
bun run company-brain add integrations --target cloud --only notion,slack
```

This step only creates the selected source integrations. Syncs are added
separately after you create the OAuth connections.

## Connect Sources

In the Nango dashboard, create OAuth connections only for the sources you want
to try first. Suggested connection IDs:

- `notion/notion`
- `slack/slack`
- `github/github`
- `google-mail/gmail`

Circleback MCP is a manual Nango integration. If you want to ingest Circleback
meetings, create and manage the `circleback-mcp` integration and its connection
in Nango yourself, then add that sync explicitly.

## Add Syncs

After you create the OAuth connections in Nango, add syncs for every source
integration you installed:

```bash
bun run company-brain add syncs
bun run company-brain add syncs --target cloud
```

For non-interactive use or manual overrides:

```bash
bun run company-brain add syncs --only notion,slack
bun run company-brain add syncs --target cloud --only notion,slack
```

`--only` overrides the installed-integration list and accepts numbers such as
`--only 1,2`. `--all` adds every default managed source sync.

Default source sync integrations are:

- `notion` - Notion pages
- `slack` - Slack threads
- `github` - GitHub pull requests
- `google-mail` - Gmail threads

Manual sync integrations are:

- `circleback-mcp` - Circleback meetings

## Agent Sync

Agent conversations are not installed with the default source integrations. Add
them after the target Company Brain stack is running:

```bash
bun run company-brain agent-sync install
bun run company-brain agent-sync install --target cloud
```

The install command checks that the selected target is healthy, makes sure the
Nango dev API key is saved, installs the hidden `agent-conversations`
integration and `conversations` sync in that target Nango, writes the local
sync config, then installs a macOS LaunchAgent that runs
`company-brain agent-sync sync-now --target <target>` on load and on the configured
interval.

Manage the schedule with:

```bash
bun run company-brain agent-sync status
bun run company-brain agent-sync sync-now
bun run company-brain agent-sync uninstall
```

Pass `--target cloud` when agent sync should point at the hosted Company Brain.

## Check Setup

```bash
bun run company-brain doctor
bun run company-brain doctor --target cloud
```

The doctors check service health, saved configuration, Nango API key
configuration, and selected sync configuration.

## CLI

The primary entrypoint is the Parsh CLI:

```bash
bun run company-brain --help
bun run company-brain target local
bun run company-brain setup
bun run company-brain add integrations
bun run company-brain add syncs
bun run company-brain agent-sync install
bun run company-brain setup --target cloud
```

For local use without typing `bun run`, install a wrapper from this checkout:

```bash
scripts/install-company-brain-cli.sh
company-brain --help
```

## Contributing

See [AGENTS.md](./AGENTS.md) for contributor and agent guidance.
