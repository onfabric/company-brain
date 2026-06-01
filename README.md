# Company Brain

Monorepo for the Company Brain experiment.

## Clone

```bash
git clone --recurse-submodules https://github.com/onfabric/company-brain
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Contributing

See [AGENTS.md](./AGENTS.md) for contributor and agent guidance.

## Agent Sync Installer Smoke Test

On macOS, run this before publishing an agent-sync release:

```bash
scripts/smoke-test-agent-sync-installer.sh
```

It builds local release assets, installs from those assets into a temporary home directory, skips LaunchAgent registration, and verifies the installed binary can read a complete configuration. Set `COMPANY_BRAIN_AGENT_SYNC_SMOKE_KEEP=1` to keep the temporary directory for inspection.
