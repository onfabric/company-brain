# Company Brain

Self-hostable Company Brain experiment: Nango collects records from workplace
tools, the brain service normalizes/searches them, and the dashboard lets you
inspect what is flowing in.

## Cloud Deployment

The installed CLI provisions and operates a hosted Company Brain stack on AWS:

```bash
curl -fsSL https://raw.githubusercontent.com/onfabric/company-brain/main/scripts/install-company-brain-cli.sh | bash
company-brain setup
```

`setup` downloads the release assets, provisions AWS infrastructure, deploys
the released containers, verifies DNS/HTTPS, then asks for the hosted Nango dev
API key. If DNS or certificate setup needs a pause, run this after making the
requested changes:

```bash
company-brain resume
```

Local deployment is a contributor workflow. Clone the repository if you want to
run Company Brain locally:

```bash
git clone --recurse-submodules https://github.com/onfabric/company-brain
cd company-brain
bun install
```

## Add Integrations

Choose and create the Company Brain source integrations you want:

```bash
company-brain add integrations
```

The CLI prompts for which source integrations to install and for OAuth app
credentials for only those integrations. You can also pass the Nango dev API
key directly:

```bash
company-brain add integrations --nango-secret-key <dev-api-key>
```

Use this callback URL for hosted OAuth apps:

```txt
https://<nango-hostname>/oauth/callback
```

For non-interactive use, pass the integrations explicitly:

```bash
company-brain add integrations --only notion,slack
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
```

For non-interactive use or manual overrides:

```bash
company-brain add syncs --only notion,slack
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
them after the hosted Company Brain stack is running:

```bash
company-brain agent-sync install
```

The install command checks that the hosted deployment is healthy, makes sure the
Nango dev API key is saved, installs the hidden `agent-conversations`
integration and `conversations` sync in hosted Nango, writes the local sync
config, then installs a macOS LaunchAgent that runs
`company-brain agent-sync sync-now` on load and on the configured interval.

Manage the schedule with:

```bash
company-brain agent-sync status
company-brain agent-sync sync-now
company-brain agent-sync uninstall
```

## Check Setup

```bash
company-brain doctor
```

The doctor checks AWS access, Terraform outputs, DNS, HTTPS, remote Docker
services, and hosted Nango API key configuration.

## Update A Hosted Deployment

Update the existing hosted stack to the newest published Company Brain release:

```bash
company-brain update
```

To pin an exact release:

```bash
company-brain update --version v0.4.0
```

The update command keeps the same AWS infrastructure, DNS names, secrets, and
persistent data volume. If a release declares a new infrastructure version, the
CLI applies the release's Terraform bundle before redeploying containers. If
the installed CLI is too old for the target release, re-run the installer to get
the latest CLI binary, then run `company-brain update` again.

## CLI

The primary entrypoint is the installed CLI:

```bash
company-brain --help
company-brain version
company-brain setup
company-brain update
company-brain add integrations
company-brain add syncs
company-brain agent-sync install
company-brain doctor
company-brain destroy
```

Contributors can use `bun run company-brain ...` from a checkout.

The installer resolves `latest` to the newest GitHub release that contains
`company-brain-release.json`, so older Agent Sync-only releases are ignored. To
pin an exact release, set `COMPANY_BRAIN_CLI_VERSION=vX.Y.Z` before running the
installer. The installed CLI uses the same release manifest lookup unless
`COMPANY_BRAIN_RELEASE_VERSION`, `COMPANY_BRAIN_RELEASE_MANIFEST_URL`, or
`COMPANY_BRAIN_RELEASE_MANIFEST_PATH` is set.

Company Brain release images are published to GHCR for `linux/amd64`. The
release and dev deploy workflows verify that the image tags are anonymously
pullable before publishing deployable artifacts, because EC2 hosts pull them
without registry credentials.

`main` deploys continuously to the dev environment with commit-addressed image
tags. Customer-installable CLI binaries, release manifests, runtime bundles, and
versioned image tags are only published by `vX.Y.Z` GitHub release tags. Release
manifests pin images by `tag@sha256` digest so a deployment of a given release is
reproducible.

To cut a customer release, run the `Create Release Tag` workflow with a version
like `v0.4.0`. The workflow updates `cli/package.json`, refreshes `bun.lock`,
commits `chore(release): v0.4.0` to `main`, tags that commit, and dispatches the
release workflow for the tag. The release workflow refuses to build if the tag
and `cli/package.json` disagree.

## Contributing

See [AGENTS.md](./AGENTS.md) for contributor and agent guidance.
