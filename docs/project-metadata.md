# Project update notifications

How a project repository tells this portfolio it shipped, so the metadata
refresh happens immediately instead of on the next daily sync.

This document covers **only the notification hop**. The metadata system itself —
what is collected, how percentages are derived, how the timeline is merged, how
failures are handled — lives in `scripts/sync-project-metadata.mjs`,
`scripts/project-sources.mjs`, and the comments in
`.github/workflows/sync-project-metadata.yml`.

## The flow

```
project repository changes on main
        ↓
project CI / build / deployment succeeds
        ↓
project calls notify-portfolio.yml (reusable)
        ↓
repository_dispatch: portfolio-project-updated
        ↓
sync-project-metadata.yml regenerates, tests, commits if changed
        ↓
it dispatches static.yml, which deploys to Pages
```

Nothing here is required for correctness. `sync-project-metadata.yml` already
runs on a daily schedule and by hand, so a project that never notifies is at
worst a day stale. Notifications make it immediate.

## The event type

`portfolio-project-updated`.

This must match the `repository_dispatch.types` entry in
`sync-project-metadata.yml`. **A mismatch is silent** — GitHub answers any
`event_type` with `204 No Content` and simply starts no workflow — so it is
worth checking both ends when a notification appears to do nothing.

## What the payload carries

```json
{
  "repository": "BPForbes/Bailey-Forbes-Flinstone",
  "sha": "d698eae…",
  "ref": "main",
  "workflow": "Browser kernel artifact",
  "project": "flinstone"
}
```

The sync reads **none** of it. Every figure the portfolio publishes is
re-derived from GitHub, so nothing a project sends can put an unverified number
on the site, and nothing a caller controls can steer the sync. The fields exist
for the Actions log and for a future consumer.

## Adding it to a project repository

One file, `.github/workflows/notify-portfolio.yml`:

```yaml
name: Notify portfolio

on:
  workflow_run:
    workflows: ["<the workflow that publishes or validates this project>"]
    types: [completed]
    branches: [main]

permissions: {}

concurrency:
  group: notify-portfolio
  cancel-in-progress: false

jobs:
  notify:
    if: github.event.workflow_run.conclusion == 'success'
    uses: BPForbes/Bailey-Forbes-Portfolio-Site.github.io/.github/workflows/notify-portfolio.yml@main
    with:
      project: <id as keyed in scripts/project-sources.mjs>
      sha: ${{ github.event.workflow_run.head_sha }}
      ref: ${{ github.event.workflow_run.head_branch }}
      source-workflow: ${{ github.event.workflow_run.name }}
    secrets:
      PORTFOLIO_DISPATCH_TOKEN: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}
```

Then add the secret (below). The project also needs an entry in
`scripts/project-sources.mjs` for the portfolio to have anything to refresh.

## Choosing what to wait on

Notify after the workflow that makes the new state *real*, not on push:

| Repository | Waits on | Why |
| --- | --- | --- |
| `BPForbes.QPU.github.io` | **Deploy static React QPU app** | Publishes the workbench to Pages. The portfolio embeds it, so notifying on push would advertise a state whose site is not live. |
| `Bailey-Forbes-Flinstone` | **Browser kernel artifact**, plus a gate job | See below. |
| `Homework-Central` | **CI** (push only) | No site of its own, but a commit that does not build should not move the numbers. |
| `KeyQuorum` | **Test** (push only) | `cargo test --all-targets --all-features` compiles everything Compile does, so it is the stronger gate. |

### Flintstone needs more than a green run

"Browser kernel artifact" succeeding is not evidence that anything was
published. Its `deploy` job is conditional:

```yaml
needs.validate.outputs.bootable == 'true' &&
needs.validate.outputs.browser_compatible == 'true' &&
needs.validate.outputs.boot_smoke_passed == 'true'
```

A candidate that builds and tests cleanly but does not clear those promotion
gates records a blocked outcome, leaves `validate` green, and **skips**
`deploy` — the run's overall conclusion is still `success` while the lab is
unchanged.

So Flintstone's notifier runs a `gate` job first, which asks
`GET /repos/{repo}/actions/runs/{id}/jobs` what the job named *Publish validated
lab to GitHub Pages* actually concluded, and notifies only on `success`. A
skipped job — which is how a blocked promotion looks from here — stops the
notification. Anything other than an observed successful publish means the
portfolio does not move.

## The secret

| Secret | Where | Permissions |
| --- | --- | --- |
| `PORTFOLIO_DISPATCH_TOKEN` | each **project** repository | Fine-grained PAT, **only** `BPForbes/Bailey-Forbes-Portfolio-Site.github.io`, **Contents: Read and write**. Nothing else. |

`Contents: write` is what GitHub requires for
`POST /repos/{owner}/{repo}/dispatches`; it is the narrowest permission that
endpoint accepts. The token reaches no repository other than this one.

It is passed as a workflow secret, read from the environment rather than
interpolated into a command line, never echoed (no `set -x`), and never written
anywhere the browser can see. The reusable notifier declares `permissions: {}` —
it needs no access to the repository calling it.

Without the secret the job fails with an explicit message rather than silently
doing nothing.

### Why not something more native

There is no credential-free option: `GITHUB_TOKEN` is scoped to the repository
whose workflow it runs in and cannot dispatch to another repository.

The closest native alternative is a **GitHub App** with an installation token
minted per run by `actions/create-github-app-token`. That token is short-lived
rather than long-lived, which is a real improvement, and it is worth moving to
if the number of project repositories grows. It is not the default here because
the App's private key is itself a long-lived secret stored in every project
repository, so the count of long-lived secrets is unchanged while the setup
gains an App registration, an installation, and two secrets per repository
instead of one.

Because the dispatch lives in one reusable workflow, switching later is a change
to this file alone:

```yaml
- uses: actions/create-github-app-token@v1
  id: token
  with:
    app-id: ${{ secrets.PORTFOLIO_APP_ID }}
    private-key: ${{ secrets.PORTFOLIO_APP_PRIVATE_KEY }}
    owner: BPForbes
    repositories: Bailey-Forbes-Portfolio-Site.github.io
```

## Commit bodies

The sync captures two forms of each commit's text:

| Field | Where it goes | What it is |
| --- | --- | --- |
| `detail` | `src/generated/projectMetadata.ts` | The lossy one-line summary the collapsed row shows: first paragraph, no headings or tables, capped. |
| `body` | `data/commit-bodies.json` | The author's whole Markdown, for the expanded card. |

They are split deliberately. Bodies total roughly 100 KB across the history and
are only read when someone expands a card, so inlining them into the module every
page imports made the entry bundle several times its own size for text almost
nobody requests. `data/commit-bodies.json` is keyed by event identity
(`pr:owner/repo#123`) and fetched once, on the first expand.

That file is committed and tracked by the sync's change detection, like the other
two artefacts — a body edited on GitHub would otherwise change nothing the
snapshot can see, and the card would serve the old text forever.

Bodies are capped at 40,000 characters as a backstop against a runaway
description. The longest in this history is about 13,000, so nothing is cut in
practice and the card never shows an ellipsis it invented.

Rendering is `src/commitBody.tsx` — react-markdown with remark-gfm, remark-math
and rehype-katex — reached through a dynamic `import()`. The chunk, KaTeX's
stylesheet and the bodies file are all fetched on the first expand and never for
a visitor who does not open one. `rehype-raw` is deliberately not enabled, so raw
HTML in a commit body stays text; link targets are restricted to http, https and
mailto; and images are not requested, their alt text shown instead.

## Loops

A notification cannot cause another notification. The dispatch starts
`sync-project-metadata.yml` in this repository; that job commits with
`GITHUB_TOKEN`, and a `GITHUB_TOKEN` push deliberately raises no workflow events
— GitHub's own loop protection — which is why it has to start `static.yml`
explicitly. Nothing in that chain reaches back into a project repository, so
there is no path from a sync to another notification.

Concurrency does less than it might look like, so it is worth being precise
about what it does and does not guarantee when several projects ship at once.

The notifier's `concurrency` group lives in each **project** repository, so it
only serialises that one repository's notifications. It cannot combine or
suppress notifications coming from different repositories — four projects
shipping together send four dispatches.

The receiver's group prevents two syncs from running at the same time, which is
what stops them racing to commit the same file. Beyond that, GitHub holds at
most one pending run per group and a newer pending run replaces the older one,
so a burst *can* coalesce into fewer syncs than dispatches. It is not guaranteed
to collapse into exactly one: whether a dispatch starts its own run or replaces
a pending one depends on what is in flight when it arrives.

None of that affects correctness. Each sync re-derives every figure from
scratch, so a coalesced run and a run per dispatch produce the same result — the
only difference is how many times the work is done.
