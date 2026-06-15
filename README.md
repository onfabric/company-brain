# Company Brain

Self-hostable Company Brain experiment: Nango collects records from workplace
tools, the brain service normalizes/searches them, and the dashboard lets you
inspect what is flowing in.

## Local First

Start locally before thinking about AWS, domains, or GitHub Actions.

```bash
curl -fsSL https://raw.githubusercontent.com/onfabric/company-brain/main/scripts/install-company-brain-cli.sh | bash
company-brain target local
company-brain setup
```

Contributors can still run the CLI from a checkout:

```bash
git clone --recurse-submodules https://github.com/onfabric/company-brain
cd company-brain
bun install
bun run company-brain target local
bun run company-brain setup
```

Local URLs:

- Brain dashboard: http://localhost:3010/
- Nango dashboard/login and API keys: http://localhost:3003

`setup` with the local target downloads the release assets, generates env
files, starts Docker Compose by default, waits for the stack to become healthy,
then asks for the local Nango dev API key at the end. Use
`company-brain setup --skip-start` if you only want to generate local env files.
Run `company-brain resume` to restart the local stack or save the Nango API key
later.

## Cloud

Provision the hosted Company Brain stack on AWS:

```bash
company-brain target cloud
company-brain setup
```

`setup` with the cloud target provisions AWS infrastructure, deploys the
released containers, verifies DNS/HTTPS, then asks for the hosted Nango dev API
key at the end. If DNS or certificate setup needs a pause, run this after
making the requested changes:

```bash
company-brain resume
```

Use `--target local` or `--target cloud` on any target-aware command to override
the saved target for one run:

```bash
company-brain doctor --target cloud
```

## Add Integrations

Choose and create the Company Brain source integrations you want:

```bash
company-brain add integrations
company-brain add integrations --target cloud
```

The CLI prompts for which source integrations to install and for OAuth app
credentials for only those integrations. You can also pass the Nango dev API
key directly:

```bash
company-brain add integrations --nango-secret-key <dev-api-key>
company-brain add integrations --target cloud --nango-secret-key <dev-api-key>
```

Use this callback URL for local OAuth apps:

```txt
http://localhost:3003/oauth/callback
```

For non-interactive use, pass the integrations explicitly:

```bash
company-brain add integrations --only notion,slack
company-brain add integrations --target cloud --only notion,slack
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
company-brain add syncs
company-brain add syncs --target cloud
```

For non-interactive use or manual overrides:

```bash
company-brain add syncs --only notion,slack
company-brain add syncs --target cloud --only notion,slack
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
company-brain agent-sync install
company-brain agent-sync install --target cloud
```

The install command checks that the selected target is healthy, makes sure the
Nango dev API key is saved, installs the hidden `agent-conversations`
integration and `conversations` sync in that target Nango, writes the local
sync config, then installs a macOS LaunchAgent that runs
`company-brain agent-sync sync-now --target <target>` on load and on the
configured interval.

Manage the schedule with:

```bash
company-brain agent-sync status
company-brain agent-sync sync-now
company-brain agent-sync uninstall
```

Pass `--target cloud` when agent sync should point at the hosted Company Brain.

## Check Setup

```bash
company-brain doctor
company-brain doctor --target cloud
```

The doctors check service health, saved configuration, Nango API key
configuration, and selected sync configuration.

## CLI

The primary entrypoint is the installed CLI:

```bash
company-brain --help
company-brain target local
company-brain setup
company-brain add integrations
company-brain add syncs
company-brain agent-sync install
company-brain setup --target cloud
```

Contributors can use `bun run company-brain ...` from a checkout.

The installer resolves `latest` to the newest GitHub release that contains
`company-brain-release.json`, so older Agent Sync-only releases are ignored. To
pin an exact release, set `COMPANY_BRAIN_CLI_VERSION=vX.Y.Z` before running the
installer. The installed CLI uses the same release manifest lookup unless
`COMPANY_BRAIN_RELEASE_VERSION`, `COMPANY_BRAIN_RELEASE_MANIFEST_URL`, or
`COMPANY_BRAIN_RELEASE_MANIFEST_PATH` is set.

Company Brain release images are published to GHCR for `linux/amd64` and
`linux/arm64`. The release and dev deploy workflows verify that the image tags
are anonymously pullable before publishing deployable artifacts, because local
Docker and EC2 hosts pull them without registry credentials.

## Contributing

See [AGENTS.md](./AGENTS.md) for contributor and agent guidance.
