# AGENTS.md — Project pages and data

The five project folders (`emr`, `flinstone`, `homework-central`, `keyquorum`, `qpu`), the project index, and the old `*.html` redirect files that point at the folders.

## Rules for this folder

- Pages with a live lab follow the same structure: hero with a motif, a stat list, a strength statement, the live lab or the screenshots, the language split, the technical write-up behind a disclosure, and the timeline rail. Keep the order.
- A live lab is a guest window: `<div data-guest-window data-guest="<id>">`. The id must be one `src/guestWindow.ts` knows (`flinstone`, `keyquorum`, `qpu`). The origins live in `src/apps.ts`, which only `guestWindow.ts` imports. The EMR page has no lab.
- Figures that the repository owns use `data-project-version`, `data-project-commits`, or `data-project-prs`. Their text in the HTML is a fallback that a visitor sees before the script runs; keep it equal to the last synced value.
- Screenshots and transcripts are evidence (DESIGN.md R15). A caption names the commit and the date that produced it. Never replace a real capture with a mock-up.
- Copy about a project must match that project's own docs. For KeyQuorum read [`docs/agents/keyquorum.md`](../docs/agents/keyquorum.md) first; for the others see [`docs/agents/multi-repo.md`](../docs/agents/multi-repo.md).
- The EMR page says its client tree is private and its language split is an estimate. Keep both statements.
- Topic tags are `<span class="chip" data-topic="<id>">Label</span>` inside an element marked `data-filter-item`. The id must exist in `src/topics.ts` and the text must equal its label; `tests/topics.test.mjs` fails otherwise. Tag only what the project's repository or the résumé shows; the evidence for each current tag is in `DESIGN.md` B4. Keep the home tile and the projects-index row of a project tagged alike.

## Related instruction files

These files refer to each other. A change to one that affects another should update both.

- [`AGENTS.md`](../AGENTS.md): project pages and their data
- [`DESIGN.md`](../DESIGN.md): design rules and evidence rules for project pages
- [`docs/agents/keyquorum.md`](../docs/agents/keyquorum.md): KeyQuorum copy must match its own docs
- [`docs/agents/multi-repo.md`](../docs/agents/multi-repo.md): project data and embeds come from other repositories
- [`projects/CLAUDE.md`](CLAUDE.md): Claude Code imports this file
- [`src/AGENTS.md`](../src/AGENTS.md): the lab mounts and origins that pages use
