# Company Brain

Monorepo for the Company Brain experiment.

## Repository layout

- `nango/` — git submodule of [onfabric/nango](https://github.com/onfabric/nango), tracking its `master` branch. This is upstream Nango with encryption made optional: leaving `NANGO_ENCRYPTION_KEY` empty disables encryption and stores credentials/records as plaintext (upstream hard-requires the key). You can make edits inside this folder directly and push them. Before starting any work, run `git submodule update --remote --merge nango` to pull the latest `master`, and commit the updated submodule pointer if it moved.
- `nango-integrations/` — Nango function implementations. Before creating or changing a sync, read [Nango Sync Guidelines](nango-integrations/SYNC_GUIDELINES.md); record schemas should stay simple, embedding-friendly, and free of unnecessary provider details.

## Code Style

- No comments that restate what types and naming already say — only comment the non-obvious
- No comments to highlight code sections - split the files if it's too big or contains unrelated code
- No comments to explain a refactor
- Keep files small and domain-scoped: one concern per file. When a file starts mixing concerns, split into as many files as concerns
- Single source of truth — never duplicate keys, enum values, or type info that belongs to a class/module; derive from the source instead

## Validation

After finishing an implementation, always run:

1. `bun fix:codestyle` — auto-fix formatting/lint issues
2. `bun check:all` — verify types and codestyle pass
3. `bun run test` - verify that the code is working properly, including safety of the types exposed by the packages

## Run scripts

When running a script, always check `package.json` scripts (root and per-app) for available commands first.

## Conventions

- Always use Conventional Commits for commit messages and PR titles.
