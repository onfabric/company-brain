---
name: build-weekly-timeline
description: Use this repo-local skill to build the Company Brain's weekly timeline — a horizontal, week-by-week account of what Fabric was actually doing, distilled from every record in that week and interpreted against the existing knowledge base. Trigger when asked to build, grow, or extend the weekly timeline; to write a "week of" entry; to reconstruct or narrate what happened in a given week, month, or period; or to add the temporal/chronological section to the knowledge base. Unlike build-knowledge-base, the unit here is a span of time, not an entity: one entry per ISO week, each pulling together that week's records and linking out to the people, companies, and products in motion. Runs human-in-the-loop: propose the next week, gather and interpret its records, draft a visual HTML entry, then reconcile the timeline hub and adjacent weeks.
---

# Build Weekly Timeline

A second axis for the Company Brain. The [build-knowledge-base](../build-knowledge-base/SKILL.md) loop builds the **entity axis** — one page per person, company, or product, each telling that entity's whole story across time. This skill builds the **time axis** — one page per week, each telling what Fabric was doing *that week*, across all entities. The two cross-link: a week entry names the entities active that week and links to their pages; an entity's timeline is reconstructed by reading the weeks it appears in.

**This skill is a specialisation of [build-knowledge-base](../build-knowledge-base/SKILL.md), not a replacement.** Everything it doesn't redefine, it inherits unchanged: the same human-in-the-loop loop (survey → propose → gather → choose type → write → lint), the API access pattern, the proposing-a-new-type step, the HTML/sanitizer rules and the visual component kit (step 5), the draft-before-write discipline, linking by `knowledge:<id>`, and the principles. Read that skill first, and use [research-knowledge-entity](../research-knowledge-entity/SKILL.md) as the investigation playbook — it applies to a span of time exactly as it does to an entity. What follows is **only what changes when the unit is a week instead of an entity.**

## What a week entry is

One `knowledge` item per ISO week (Monday 00:00 through Sunday 23:59:59, in a single fixed timezone you keep consistent across every week). It is **not** a dump of that week's records, and **not** a duplicate of facts that belong on entity pages. It is a synthesised answer to: *what was Fabric working on this week, what moved, who was involved, and what does it mean in the larger arc?* — told as a short, visual, hyperlinked narrative.

- **Title**: a stable, chronological convention, e.g. `Week of 2025-01-06 (Jan 6–12, 2025)`. Lead with the ISO Monday date so weeks sort and scan in order; keep the human range in parentheses.
- **Type**: a dedicated reusable `Week` type for these entries. The hub below uses its own `Timeline` type. Propose whichever doesn't exist yet and get approval, per build-knowledge-base's choose-the-type step — that step is unchanged.
- **Evidence**: attach every record in the week's window as the entry's `record_ids`, and the people active that week as its `person_ids`. The week page is the one place those records are collectively interpreted.

## The timeline hub

The temporal counterpart of the build-knowledge-base **index**. Everything true of the index is true here — single hub, its own dedicated type so there is only ever one, navigation-not-content, updated every iteration, a missing/stale hub is the top-priority fix. The differences:

- It is a **chronological strip**: every week entry as a one-line "what this week was about" with a `knowledge:<id>` link, grouped under months or quarters as it grows.
- It is **separate from the main index** (which stays the entity hub). Add a one-line pointer to this hub from the main index under a "Timeline" section, once, when the hub is created, so it's reachable from the landing page.

## Gather and interpret the week

This replaces build-knowledge-base's *gather everything about the chosen entity* step, and is the heart of the skill: raw records are noisy and contextless, and a week only becomes legible when read against the entity pages and the surrounding weeks. Use [research-knowledge-entity](../research-knowledge-entity/SKILL.md)'s investigation method throughout (cast a wide net, read the strongest sources in full, follow leads, keep the evidence trail) — applied to a window of time:

1. **Pull the full window.** Fetch *every* record with `created_after` = the week's Monday and `created_before` = the following Monday. Paginate to completion (use the response `total`); do not reason from the first page. These records are the entry's evidence set.
2. **Cluster, don't list.** Group the window by data source, by people, and by topic to find the week's **threads** — the few real things going on (a deal in motion, a feature being built, a hiring loop, an investor conversation, a fire). A week entry is organised around threads, not records.
3. **Keep only what mattered to the team.** The weekly timeline is a *company-level* view, so the bar for inclusion is **shared significance, not individual receipt**. Ask of every candidate thread: did this matter to Fabric — work the team did, a decision, a relationship or deal in motion, something that moved the business or that the team would want on the record? Drop whatever only incidentally touched one person and carried no team-level weight: cold outreach, newsletters, marketing and vendor spam, automated alerts and notifications (unless one actually triggered action — e.g. an alarm flood that prompted a fix), routine receipts, and personal correspondence. A random email that landed in one person's inbox and changed nothing for anyone else does **not** belong on the page, however much raw volume it represents — most of the window is usually noise, and cutting it is the point. When you can't tell whether something rises to team-level relevance, leave it out: the timeline is a curated account of the week, not a log of it. (Heavy noise can be acknowledged in one line — "~90% of the inbox was cold outreach" — without itemising any of it.)
4. **Only what's genuinely new this week.** A weekly update reports *developments*, not standing conditions. For every candidate thread ask: is this new this week, or was it already true before it? **Collapse repetition ruthlessly.** A signal that recurs on a schedule — a daily alert, a newsletter, an automated error that fires every day, a "your invoice is ready" — is steady-state background, not an event, however many records it produces. Volume of identical messages is not significance: **if the same "accident" email arrives every day, it is not an accident.** What *can* earn a place is a genuine *change* in such a signal — the day it first started, an unusual spike, or its resolution — reported once, as the event it is, not as a daily drumbeat. The same discipline applies to ongoing work: a multi-week project belongs on the page only where it actually *moved* this week (a decision, a ship, a setback), never to restate that it is still underway. Reading the previous weeks (step 6) is how you tell the genuinely new from the already-known.
5. **Interpret each surviving thread against the knowledge base.** This is what makes the entry worth reading. For every entity that shows up, **read its existing knowledge page** to understand what the week's records actually mean — an email from a contact is noise until the entity page tells you they're a gatekeeper at a key partner; a terse Slack thread only lands once you know the product's strategy. Interpretation also feeds back into steps 3–4: context is often what tells you a thread *is* (or isn't) team-relevant, or whether a busy-looking signal is actually new. If a clearly central entity has no page yet, flag it as a **dangling lead** for a build-knowledge-base iteration.
6. **Read across the week's boundaries.** A thread rarely starts and ends inside seven days. Read the adjacent weeks' entries and reach for records just before and after the window to place the week in the arc — and, crucially, to tell what is genuinely new this week from what was already underway or merely recurring.
7. **Know when you're done.** You can name the week's few real threads, you understand each well enough to say *why it mattered to the team*, you've linked the entities in motion, and the open questions are genuinely unanswerable from the material. If a major thread is a blank, interpret it against the relevant entity page or mark it honestly as unclear — don't paper over it.

## Write the week as HTML

Follow build-knowledge-base **step 5** in full for the HTML-fragment rules, the sanitizer allowlist, the component kit, linking, and the draft-before-write gate. The body reads as a cohesive, **scannable account of the week** told through its few real threads, with the entities in motion linked out — not a record log, a per-source breakdown, or a Q&A. The week-specific choices:

- **Lede + headline stats.** Open with one `<p class="lede">` stating what the week was about. Follow with a `stat-grid` of 3–4 short figures that fit a week — records in the window, distinct people active, top data source, meetings or shipped items.
- **A within-week timeline is the spine.** Use `<ol class="timeline">` to walk the week's notable moments in order, Monday → Sunday, marking the opening moment `is-start` and the closing/"where it stood by Sunday" moment `is-end`. This is what makes the page read as a *week* rather than a topic note.
- **Cards for parallel threads.** When several workstreams run at once (product, fundraising, hiring, a partner deal), a `<div class="cards">` set — one `card` per thread — reads better than stacked prose.
- **Link both axes.** Link every entity the week names with `knowledge:<id>` (the cross-link to the entity axis), and link the **previous and next week** entries so the strip is walkable. A week states only what's relevant to *that week* about an entity and links out for the rest — single source of truth; don't re-tell an entity's story here.
- **Be honest about quiet weeks.** If little happened, the entry is short and says so. Don't inflate.

## Lint: reconcile the hub and neighbours

Same lint step as build-knowledge-base (backlink, update the hub, fold newly-found facts into entity pages, all drafted and approved before any write), with one addition unique to the time axis:

- **Stitch the strip.** Add reciprocal `previous week` / `next week` links between the new entry and its neighbours — update the week that now has a successor to link forward to this one. Then insert the new week into the timeline hub in chronological position.

## Week-specific principles

The build-knowledge-base principles all carry over. Two are worth sharpening for this skill:

- **Threads over records.** A week entry is organised around the few real things that happened, not around the raw records. Interpreting the records against the knowledge base is the work; listing them is not.
- **Team relevance is the inclusion bar.** This is a company-level view: include what mattered to Fabric as a whole — work, decisions, relationships and deals in motion — not whatever merely landed in one person's inbox. Cut cold outreach, newsletters, spam, routine notifications, and personal correspondence with no team-level weight. When unsure, leave it out.
- **New, not recurring.** A week reports what *changed*, not what was already true. A signal that repeats on a schedule — a daily alert, a newsletter, an automated error — is steady state, not news; collapse it and report only a real change in it (its onset, an unusual spike, or its resolution). Volume of identical messages is not significance.
- **Connected on both axes.** A week with no prev/next links, not in the hub, and linking to no entity pages is half-done. Stitch the strip *and* cross-link the entities every iteration.
