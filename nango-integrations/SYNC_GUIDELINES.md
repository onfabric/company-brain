# Nango Sync Guidelines

Use these guidelines when creating or changing a Nango sync in this repository.

## Research First

Start from Nango's integration templates: https://github.com/NangoHQ/integration-templates/tree/main/integrations. Look for the provider and nearby use cases before writing new logic.

Read the provider's own API docs too. Identify the endpoints, pagination, rate limits, expansions, and related resources needed to build complete, legible records.

Use the templates and provider APIs as inputs, then design a Company Brain-shaped sync. Do not copy a template blindly if it stores provider-shaped data that is too raw for our records.

## Saved Record Contract

Treat records saved with `nango.batchSave()` as long-lived application contracts. Keep them simple, readable, and useful for search, embedding, and display.

Keep:

- stable root `id` required by Nango
- source context, such as channel, project, repository, document, or path
- timestamps for the record and important nested events
- legible actor names and provider-exposed disambiguators, such as email
- content, replies, comments, reactions, files, links, and other user-visible facts

Normalize every saved timestamp to an ISO 8601 date string. Preserve the provider's timezone when the source value includes one, and convert accurately from provider-specific formats such as Unix seconds, Unix milliseconds, or local datetime strings with offsets. If the provider value has no timezone information, treat it as UTC rather than guessing a local timezone.

Avoid:

- nested provider IDs
- raw payloads, blocks, attachments, cursors, pagination metadata, and debug fields
- provider object types, permissions, private flags, team IDs, and other implementation details
- duplicate counts or labels that can be derived from existing fields

Use richer internal types while fetching and mapping if needed. Save only the simplified record.

## Hydrate Context

Records should be understandable on their own. When a provider returns sparse references, call supporting APIs to resolve useful context before saving: actors, locations, parent objects, related resources, titles, paths, URLs, timestamps, or other human-readable details.

Hydrate only when it improves retrieval, display, or disambiguation. Do not copy large related payloads just because they are available.

## Markdown Body

Every discoverable record should include a root `body` field with semantically meaningful Markdown. It should read like a concise source document, not a JSON dump.

Include:

- a heading with source context
- important timestamps
- each nested message, reply, comment, or event with its own timestamp and author
- user-visible content
- mentions, reactions, files, links, and other facts that matter for retrieval

Do not hide important information only in nested structured fields. If it matters for retrieval, include it in `body`.

## Compact Nested Data

Keep nested arrays compact:

- represent people with human-readable identifiers and provider-exposed disambiguators, not raw provider internals
- represent links and external references with the smallest useful shape for retrieval and display
- represent attachments with only the information needed to understand who shared them, when, and where to access them
- represent reactions, replies, comments, and other nested events with their own meaningful time, actor, content, and compact context

If the provider does not expose a timestamp for a nested item, do not invent one. Associate it with the nearest meaningful parent event only when that is honest and useful.

## Save Progress Incrementally

Save records periodically with `nango.batchSave()` as pages or batches are processed. Do not wait for the entire provider dataset to download before writing records.

Prefer bounded batches that keep memory use low and make partial progress durable. If the sync uses checkpoints, advance them only after the corresponding records have been saved.

## Schema And Tests

Define the saved model with Zod and derive TypeScript types from it. Do not duplicate model keys or type information.

Tests should:

- parse saved records with the exported model schema
- assert that `body` includes important content
- assert that raw provider fields and unnecessary IDs are absent
- use realistic provider payloads

When the saved model changes in a breaking way, bump the sync version, run `bun run compile`, and commit the generated `.nango/nango.json` update. Existing Nango records may need to be cleared with `reset: true` and `emptyCache: true` before a fresh sync.

## Reference Example

Use the Slack thread sync as the reference example: `nango-integrations/slack/syncs/threads.ts`.

It keeps the root ID Nango needs, simplifies provider data before saving, and renders a Markdown `body` for embedding. Refer to the implementation and tests instead of copying snippets into this guide.
