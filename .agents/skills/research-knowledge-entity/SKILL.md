---
name: research-knowledge-entity
description: Use this repo-local skill to research a single Company Brain entity deeply and turn it into one cohesive knowledge entry. Trigger it from the build-knowledge-base loop once the user has picked an entity to add or enrich — it governs steps 3 (gather) and 5 (write). It explains how to investigate an entity end to end (mining records, people, meetings, Slack, email, GitHub, Notion across every alias), how to follow leads and form new questions until the picture is complete, and how to write the result as a focused, hypermedia-linked story rather than a Q&A. Use it whenever you are about to research an entity or draft its entry body.
---

# Research a Knowledge Entity

This skill covers two stages of the [build-knowledge-base](../build-knowledge-base/SKILL.md) loop: **step 3 (gather everything about the chosen entity)** and **step 5 (write the entry as HTML)**. Read this once the user has picked an entity; everything about *which* entity to do next, the draft-before-write rule, index upkeep, and backlinking lives in the main skill and still applies.

**Treat every entry as a deep-research project.** The goal is not to answer a fixed set of questions — it is to paint a complete, accurate picture of the entity from the raw material, and then tell that picture as a single coherent story. A shallow entry that hits the obvious facts and stops is a failure even if nothing in it is wrong. Keep investigating until the picture stops changing.

## How to investigate

1. **Map every data source that could know about this entity — then explore all of them.** Before searching, stop and think deliberately about *which* sources are likely to hold information on this specific entity, and do not stop at the obvious one. An entity that lives mostly in Slack will still have traces in meetings, email, and GitHub, and each adds something the others miss. List the candidate sources up front and commit to checking **every** relevant one — skipping a source because another already gave you "enough" is how the picture ends up wrong or thin. The point of touching all of them is cross-referencing: the same fact seen from Slack, a meeting, and an email is confirmed; a discrepancy between them is itself a finding.
2. **Cast a wide net within each source.** Search `records` and `people` for the entity under *every* spelling, handle, email, alias, nickname, and former name. People change emails and surnames; companies rebrand; products get renamed mid-life. Missing an alias means missing half the story.
3. **Read the strongest sources in full.** Don't distill from snippets. Open the meetings, threads, and documents that mention the entity most or most substantively and read them properly. The interesting facts — a decision, a fallout, a pivot — are usually in the body, not the subject line.
4. **Mine every kind of source.** The raw material spans meeting notes and transcripts, Slack discussions, email exchanges, calendar events, GitHub activity, Notion docs, and more. Different source types answer different questions: meetings and email reveal relationships and what was said; GitHub and Notion reveal what was actually built or written; Slack reveals day-to-day reality and tone. **Circleback is a critical source for external people and companies** — its meeting notes and transcripts capture what was actually said in calls with investors, customers, partners, and prospects, which is often the richest (sometimes the only) record of an external relationship. Always check Circleback when researching anyone or any company outside the Fabric team. Cross-check sources against each other — what someone said in a meeting and what landed in GitHub are both part of the truth.
5. **Follow the leads.** Every source surfaces new threads: a name you haven't covered, a project you didn't know about, a date that contradicts another, a company on the other side of a deal. Pull each thread. Research is iterative — each pass should raise new questions that the next pass answers, and a new lead can point back at a source you thought you were done with.
6. **Form your own questions.** The starting points below are seeds, not a checklist. Once you know the entity, you will know what *else* matters about it — ask those questions too, and chase them down. An entry that only answers the seed questions hasn't been researched, only filled in.
7. **Keep the evidence trail.** Hold onto the `record` ids and `person` ids behind every claim — they become the entry's source records and participants, and they let any reader trace a statement back to where it came from.
8. **Know when you're done.** You have enough when new sources stop changing the picture — when you can narrate the entity's arc end to end, you understand how it connects to the rest of the brain, and the open questions left are genuinely unanswerable from the material (not just unsearched). If a major phase is a blank — a person with no described work, a deal with no outcome, a product with no status — you are not done.

## Starting points per type

These are **prompts to begin exploration**, not fields to fill. Branch, skip what doesn't apply, and add your own questions as the material demands. Wherever an answer names another entity, that is a link to make (see *Writing the entry*).

### Person

- Is this person part of the Fabric team, or external? This is the first fork and it changes everything downstream.
- **If internal (Fabric team):** When did they start? What's their background before Fabric? What have they worked on, and what concretely shipped — pull deliverables from GitHub, Notion docs, Slack, launches. How has their role evolved over time? Is there an interesting timeline of what they touched and when?
- **If external:** How do they fit into the Fabric story? Are they an investor, customer, partner, advisor, candidate, or someone Fabric spoke to once? What interactions has anyone at Fabric had with them — look at Circleback meeting notes and transcripts, Notion notes, and email exchanges. What did Fabric learn from them? Which company are they with, and what are they doing now? Is there an interesting timeline to their relationship with Fabric?

### Company

- How is the company related to Fabric — customer (current? churned? early? recent?), competitor, partner, advisor, investor, vendor, acquirer target? Name the relationship precisely.
- How did Fabric engage with it, and how did that engagement evolve? Was there a specific project or deal? Who were the key people on both sides? What meetings happened (Circleback notes and transcripts, calendar, Notion) and what were they about? Any relevant email threads or Slack discussions?
- What were the wins and losses? What did Fabric learn from the relationship? Is there an interesting timeline from first contact to where things stand now? Where does the relationship stand today?

### Product

- What is the product, and what problem does it solve? How did it come about — whose idea, what triggered it?
- Who were the main contributors? Where did it fit in Fabric's broader strategy, and alongside Fabric's other products? Who were the target customers, and what did Fabric learn from them?
- What's its current status — live, paused, killed, pivoted? Why did it succeed or fail? Is there an interesting timeline from conception through its phases? Pull the real evidence from Notion, Slack, and GitHub, not just the pitch.

### Other types

The brain's schema is open. If you are researching a type beyond these (e.g. a Decision, an event, a market), apply the same method: establish what it is and how it connects to Fabric, find every source that touches it, follow the leads, and reconstruct its full arc. Derive the starting questions from the entity's nature.

## Writing the entry

The output is a **cohesive, complete story of the entity — not a Q&A, FAQ, or filled-in form.** The starting-point questions are how you *researched*; they must not show up as headings or as a list of question-answer pairs. Synthesize everything you found into a flowing narrative (with whatever structure best fits — prose, a timeline, a fact list, sections) that reads as one account of the entity.

- **Center the page on this entity, Wikipedia-style.** The entry can be as long as the entity warrants, but every part of it must be *about this entity*. When the story touches another entity that has (or should have) its own entry, **do not re-explain that entity** — state only what is relevant to the one you're writing, and link out so the reader can navigate for the rest. A person's entry mentions their company in one line and links to it; the company's full story lives on the company's page.
- **Link every entity reference.** Follow the linking mechanics in [build-knowledge-base](../build-knowledge-base/SKILL.md) (step 5): use `knowledge:<id>` hrefs so cross-links are clickable and stable, and add the reciprocal backlinks and index entry during the lint step (step 6). If a referenced entity has no entry yet, note it as a dangling lead — a strong candidate for a future iteration.
- **Tell the arc, not the trivia.** Lead with what matters about the entity and how it connects to Fabric; weave dates and facts into the narrative rather than dumping them. Cut anything that restates the title, repeats another entry, or is source plumbing.
- **Stay evidence-backed.** Every claim should trace to the records and people you attach. Where the material is uncertain or conflicting, say so plainly rather than smoothing it into false confidence.
- **Obey draft-before-write.** As always, produce the reviewable local draft and get the user's approval before anything reaches the brain — see the main skill's step 5 and the draft-before-write principle.
