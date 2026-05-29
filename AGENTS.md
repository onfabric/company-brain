# Company Brain

Monorepo for the Company Brain experiment.

## Repository layout

- `nango/` — git submodule of [onfabric/nango](https://github.com/onfabric/nango), tracking its `master` branch. This is upstream Nango with encryption made optional: leaving `NANGO_ENCRYPTION_KEY` empty disables encryption and stores credentials/records as plaintext (upstream hard-requires the key). You can make edits inside this folder directly and push them. Before starting any work, run `git submodule update --remote --merge nango` to pull the latest `master`, and commit the updated submodule pointer if it moved.

## Conventions

- Always use Conventional Commits for commit messages and PR titles.
