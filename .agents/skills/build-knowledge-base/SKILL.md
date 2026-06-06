---
name: build-knowledge-base
description: Use this repo-local skill to iteratively distill the Company Brain's raw records and people into a connected, hypermedia knowledge base. Trigger when asked to build, grow, populate, or expand the knowledge base; to distill records into knowledge; to create, link, or backlink knowledge entries; or to maintain the knowledge index. Runs as a human-in-the-loop loop: survey what already exists, propose the most relevant person/company/product to add next, get the user's pick, then research and create a richly linked HTML entry, reconcile the index and related entries, and have the user review every entry created or modified.
---

# Build Knowledge Base

Turn the Company Brain's raw, machine-ingested records into a curated, cross-referenced knowledge base — one entity at a time, with the user choosing what matters next. The model is Karpathy's LLM-maintained wiki: raw sources (records) are distilled into a persistent wiki (knowledge entries) organized by a schema (knowledge types), and the wiki is continuously *linted* so entries stay consistent and reference each other.

This skill is about **how to distill and connect knowledge**, not an API reference; request/response shapes live in the OpenAPI spec.

## API access

The spec is the source of truth for the `knowledge`, `knowledge-types`, `records`, and `people` tags — read it each run, since the API evolves: `https://brain-dev.onfabric.io/openapi` (human) and `https://brain-dev.onfabric.io/openapi/json` (machine-readable).

The tags you will use:

- `records`, `people` — the raw material. Read-only. Search and read to discover entities and gather evidence.
- `knowledge-types` — the schema. The allowed categories an entry can belong to.
- `knowledge` — the wiki. List/search to see what exists; create new entries; update existing ones to keep them connected.
- `sessions` — mints a browser session cookie so the HTML pages are navigable in a browser.

Each knowledge item has a browser-navigable HTML representation. JSON responses expose its path in `html_url` (`/knowledge/pages/<id>`); that page renders the sanitized body and accepts either the `api-key` header or a session cookie from `POST /sessions`. This is what makes the cross-links between entries clickable — confirm the exact shapes from the spec.

## The loop

One iteration adds (or enriches) exactly one entity, with the user in the loop. From an empty base, repeating the loop fills the wiki in priority order. Existing entries inform what to explore next.

### 1. Survey what exists

- List the knowledge types and all current knowledge entries. Read the **index** entry (see below) if it exists.
- Build a mental map: which people, companies, and products are already covered, and what each existing entry already links to. This both avoids duplicates and surfaces the obvious next hops (an entry on a company points at unwritten entries for its people, products, competitors, investors…).

### 2. Propose the next entity

- Mine the raw material — search and aggregate over `records` and `people` — to find the **most relevant** not-yet-covered entity. Relevance signals: frequency and recency across records, number of records a person is attributed to, centrality (mentioned alongside already-covered entities), and whether an existing entry is "dangling" (references something that has no entry yet).
- Produce a short, ranked shortlist (3–7 candidates). For each, give the entity, its likely type, a one-line rationale, and a rough sense of how much evidence exists.
- **Present the shortlist and ask the user to pick one.** Do not pick for them. The user's choice is what makes the base reflect what *matters*, not just what's frequent.

### 3. Gather everything about the chosen entity

Treat this as a deep-research project, not a lookup — the goal is a complete picture of the entity, reached by following leads until they stop changing it. The companion skill [research-knowledge-entity](../research-knowledge-entity/SKILL.md) is the playbook for this step (and step 5): how to mine every source and alias, what to look for per entity type, and how to know when the picture is complete. Read it before researching.

- Search `records` and `people` exhaustively for the entity: every spelling, handle, email, and alias. Read the strongest records in full rather than skimming snippets.
- Pull structured facts (role, dates, relationships, decisions, numbers) and keep the source `record` ids and `person` ids — you will link the entry to them.
- Cross-reference existing knowledge: what do current entries already say about this entity, and which existing entries should this one connect to?

### 4. Choose the type — or propose a new one

- Pick the single best-fitting knowledge type for the entry.
- If nothing fits the entity well (e.g. the records reveal a recurring kind of thing the current schema can't express), **suggest a new knowledge type to the user and let them approve it** before creating it. Keep types broad and reusable (a category like "Company" or "Decision"), not one-off labels.

### 5. Write the entry as HTML

The body should read as a cohesive, complete *story* of the entity centered on that entity — not a Q&A or a filled-in form. See [research-knowledge-entity](../research-knowledge-entity/SKILL.md) for how to synthesize the research into a focused, Wikipedia-style narrative that links out to other entities instead of re-explaining them.

- The body is an **HTML fragment** (just the content — the renderer supplies the page shell, heading, and styling). There is no required schema — choose whatever representation best fits this specific knowledge: prose, bullet lists, a definition list of facts, a table, a timeline (`<time>` + lists), `<details>`/`<summary>`, `<figure>`. A person might be a fact list + timeline; a company a fact table + relationships; a decision a short narrative with context and outcome.
- **Write for the sanitizer.** Bodies are sanitized to an allowlist on save, and anything outside it is silently dropped. Use semantic tags and `class`/`id` for structure; do **not** rely on inline `style`, `<style>`, `<script>`, or inline SVG — they are stripped, and a body that sanitizes to nothing is rejected. When unsure what survives, confirm against the sanitizer rather than guessing. Keep it clean and content-first: no boilerplate, no provider/source plumbing, no restating what the title already says.
- **Link out (hypermedia).** Wherever the entry mentions another covered entity, link to that entry with a `knowledge:<id>` href: `<a href="knowledge:UUID">Name</a>`. The renderer rewrites these to the entry's HTML page so they're clickable; linking by id keeps them stable across title edits. These links are what turn the base into a navigable web rather than a pile of pages.
- **Draft locally and get approval before writing anything to the brain.** Do **not** call the create endpoint yet. First produce a reviewable draft the user can open: write the HTML body to a local file (e.g. `drafts/<slug>.html`) wrapped in a minimal standalone page so it renders in a browser, and tell the user the file path. Summarize alongside it the title, chosen knowledge type, and the `person_ids`/`record_ids` you plan to attach. Then **ask the user to approve the draft**, and apply their corrections to the draft until they sign off. Nothing is uploaded to the Company Brain until the user has explicitly approved this draft.
- **Only after approval, create the entry**, attaching the `person_ids` and `record_ids` you collected as participants and source records. Then share the new entry's live `html_url` so the user can confirm the uploaded page matches the approved draft.

### 6. Lint: reconcile the index and neighbors

Creating the entry is not the end of the iteration. Make the new knowledge *connected*, then make it *discoverable*:

- **Backlink neighbors.** For each existing entry that should reference the new one, update its HTML body to add the link. Updating an entry is now a first-class operation — see the `knowledge` tag in the spec for how to modify an existing item's title, body, and links. Links should be reciprocal where it makes sense (a company links its people; each person links back to the company).
- **Update the index.** Add the new entry to the index (next section) under the right section, with a one-line description and a link by id.
- **Fold in new facts.** If, while researching, you learned something that corrects or extends an *existing* entry, update that entry too. Over iterations this is what makes the base converge instead of drift.
- **Draft these edits and get approval before applying them too.** The draft-before-write rule covers backlinks and index updates, not just new entries. Before calling any update endpoint, show the user what you intend to change on each existing entry (and the index) — a diff, the revised body, or a local draft file — and **wait for approval**. Only after they sign off, apply the updates, then share the affected `html_url`s so they can confirm the live pages match what they approved. Edits to entries the user already approved get drafted and reviewed just like new ones.

Then return to step 1 for the next iteration.

## The index entry

The very first entry you create is the **index** — a single hub document, in the spirit of a hand-maintained wiki home page, that lists every other entry. Create it before anything else if it doesn't exist.

- Give it a clear title (e.g. "Company Brain — Index") so it's easy to find on every survey. Consider a dedicated knowledge type for it (e.g. "Index") so it's trivially queryable and there is only ever one.
- It opens with a **short** description of the company the brain is about (Fabric) — just enough orientation. The bulk of every fact lives in the dedicated entries, **never duplicated** in the index. The index's job is navigation, not content.
- Organize it like a table of contents: sections (People, Companies, Products, Decisions, …), each a list of one-line entries that link to the full knowledge item with a `knowledge:<id>` href (step 5). Nest sections and sub-lists as deeply as the base warrants — group a company's people under it, sub-categorize products, and so on as it grows.
- The index is updated on every iteration (step 6). Treat a missing or stale index as the highest-priority fix.

## Principles

- **Human-in-the-loop.** Propose; let the user choose the next entity, approve new types, and review every entry you create or modify. The point of the loop is that the base grows in *their* priority order and reflects what they've approved.
- **Draft before write — never upload unapproved.** Every write to the Company Brain (creating an entry, updating an entry, editing the index, creating a knowledge type) is preceded by a local draft or preview that the user explicitly approves. The user reviews the draft *before* it reaches the brain, not after it is already live. When in doubt, draft and ask.
- **Single source of truth.** A fact lives in exactly one entry. Everything else links to it. The index navigates; it does not restate.
- **Connected over complete.** A new entry that nothing links to and that links to nothing is half-done. Backlinking and index upkeep (step 6) are part of every iteration, not optional cleanup.
- **Evidence-backed.** Attach the source records and people to every entry so each claim is traceable back to the raw material it was distilled from.
- **Read the spec, not your memory.** Confirm endpoints, parameters, and shapes from the live OpenAPI spec each run.
