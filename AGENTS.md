# Company Brain

Monorepo for the Company Brain experiment.

## Repository layout

- `nango/` — git submodule of [onfabric/nango](https://github.com/onfabric/nango), tracking its `master` branch. This is upstream Nango with encryption made optional: leaving `NANGO_ENCRYPTION_KEY` empty disables encryption and stores credentials/records as plaintext (upstream hard-requires the key). You can make edits inside this folder directly and push them. Before starting any work, run `git submodule update --remote --merge nango` to pull the latest `master`, and commit the updated submodule pointer if it moved.

## Code Style

- No comments that restate what types and naming already say — only comment the non-obvious
- No comments to highlight code sections - split the files if it's too big or contains unrelated code
- No comments to explain a refactor
- Keep files small and domain-scoped: one concern per file. When a file starts mixing concerns, split into as many files as concerns
- Single source of truth — never duplicate keys, enum values, or type info that belongs to a class/module; derive from the source instead

## Conventions

- Always use Conventional Commits for commit messages and PR titles.
