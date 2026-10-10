# AGENTS.md — TypeScript sources

Everything here is compiled by `tsc` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) and bundled by `tools/build.mjs` into `js/`. The emitted `modules/` copy is what `npm test` imports, so rebuild after any change here and commit the regenerated `modules/`.

## Rules for this folder

- Entry points are `site.ts` (every page) and `contact.ts` (the contact form). A new behaviour goes in its own module and is called from `site.ts`, and it must run after `mountRepositoryFacts()`, so the counters count to the synced figures and not to the HTML fallbacks.
- `projectMetadata.ts` merges curated data with generated data. Generated data wins for repository facts; curated copy wins for prose.
- `display.ts` owns the Display preferences. Its boot script in every page's `<head>` must match `applyPrefs()`, or the page flashes. Scripts that animate ask `prefersReducedMotion()`, never the media query alone.
- `story.ts` is motion. Every effect must end in its final state when reduced motion is on, and must not hide content without script.
- Tests in `tests/` run against `modules/` in Node, with no DOM. A module they import must load without one. `prefersReducedMotion()` in `display.ts` is the model: it checks for a missing `document` and `matchMedia`.
- Do not add a runtime dependency without a reason the bundle cannot avoid. The commit-body chunk is already large and must stay lazy-loaded.

## Related instruction files

These files refer to each other. A change to one that affects another should update both.

- [`AGENTS.md`](../AGENTS.md): TypeScript sources and the build
- [`DESIGN.md`](../DESIGN.md): design rules the components must follow
- [`docs/agents/multi-repo.md`](../docs/agents/multi-repo.md): src/apps.ts holds the lab origins from other repositories
- [`projects/AGENTS.md`](../projects/AGENTS.md): the lab mounts and origins that pages use
- [`src/CLAUDE.md`](CLAUDE.md): Claude Code imports this file
