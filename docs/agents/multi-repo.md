# How the multi-repo system works

Read this before touching project data, project pages, the lab embeds, or any
workflow that talks to another repository. Root instructions: [`AGENTS.md`](../../AGENTS.md).

## The shape of it

bailey-forbes.com is one repository. Each portfolio project that has code of its
own lives in another repository under the `BPForbes` GitHub account. The portfolio
never copies their code. It reads facts about them, embeds their live builds, and
links to them.

| Portfolio id | Repository | Role on the site | Built and hosted by |
|---|---|---|---|
| `flinstone` | `BPForbes/Bailey-Forbes-Flinstone` | Write-up, live kernel lab (guest window), timeline, language split | Its own GitHub Pages build (`bpforbes.github.io/Bailey-Forbes-Flinstone/`) and a Cloudflare Worker for the first-visit iframe boot |
| `qpu` | `BPForbes/bpforbes.qpu.github.io` | Write-up, live workbench (`?embed=1`) | Its own GitHub Pages deploy (`bpforbes.github.io/BPForbes.QPU.github.io/`) |
| `keyquorum` | `BPForbes/KeyQuorum` | Write-up, live security lab (guest window), timeline | Lab on GitHub Pages (`bpforbes.github.io/KeyQuorum/`); relay and operator console on Cloudflare Workers (see [`keyquorum.md`](keyquorum.md)) |
| `homework-central` | `BPForbes/Homework-Central` | Write-up, timeline, PR and language figures | Self-hosted. It runs locally with Docker Compose, and has an optional Kubernetes layout. Nothing public is deployed by the portfolio |
| `emr` | none (private) | Write-up only, from curated copy | Not applicable; the client tree is not public |

The mapping lives in exactly one file: `scripts/project-sources.mjs`. Adding a
project means one entry there, plus the project page. Nothing else needs editing.
An id that is not in `PORTFOLIO_PROJECT_IDS` in that file is rejected, so a typo
cannot publish metadata for a project the site does not show.

## What flows from each repository into the portfolio

Three kinds of data, with different owners:

1. **Curated copy** lives in `src/data.ts` and the project HTML. A person wrote it.
   The sync never edits it.
2. **Generated facts** live in `data/project-metadata.json`,
   `data/commit-bodies.json` and `src/generated/projectMetadata.ts`. A scheduled
   job writes them. Never hand-edit them.
3. **Live embeds** are URLs in `src/apps.ts` (the lab origins) and `data-guest`
   mounts on the project pages. They load another repository's deployed build.

The sync reads from GitHub's public API and, where a project publishes one, the
project's own `project-metadata.json` (`contractUrl` in `scripts/project-sources.mjs`).
Flinstone also has a `versionManifest` because it versions by file, not by release.

## How a change in another repository reaches the site

```
project repo: main changes, its own build or deploy succeeds
      ↓
its notify-portfolio.yml calls the portfolio's reusable workflow
      ↓   (pinned to a commit SHA, never @main)
repository_dispatch  event_type = portfolio-project-updated
      ↓
sync-project-metadata.yml: fetch, regenerate, run npm test,
      commit only if the generated files changed
      ↓   (pushed with the SYNC_DEPLOY_KEY deploy key, which may pass the PR rule)
push to main → static.yml builds and deploys GitHub Pages
```

Three details matter when debugging:

- **The payload carries no numbers.** It says that something changed and names the
  project. The sync re-derives every figure from GitHub. A caller cannot put a number
  on the site, and the sync reads none of `client_payload`.
- **The event type must match exactly.** `portfolio-project-updated` is the only type
  the sync accepts. A mismatch is silent: GitHub answers `204` and starts nothing.
- **Without a notification the site is at most a day stale.** The daily schedule
  (05:20 UTC) and the Actions tab cover it. A notification only makes it immediate.

## The reusable notifier, and its token

`.github/workflows/notify-portfolio.yml` in this repository is the one copy of the
dispatch call. Each project's repository calls it with a short `uses:` block:

```yaml
jobs:
  notify:
    uses: BPForbes/Bailey-Forbes-Portfolio-Site.github.io/.github/workflows/notify-portfolio.yml@<commit-sha>
    with:
      project: keyquorum        # the id in scripts/project-sources.mjs
    secrets:
      PORTFOLIO_DISPATCH_TOKEN: ${{ secrets.PORTFOLIO_DISPATCH_TOKEN }}
```

- **Pin the SHA.** The caller hands its `PORTFOLIO_DISPATCH_TOKEN` to whatever that
  reference points at. A floating `@main` would let a change here see the token before
  anyone reviewed it. All current callers (Flinstone, Homework Central, KeyQuorum) pin
  the same reviewed commit. When this workflow changes, update every caller in the same
  pass, and say so in the PR.
- **The token** is a fine-grained PAT with Contents read and write on this repository
  only. It cannot touch the project repositories.
- **Callers decide when to notify.** A project with a build or a deploy notifies only
  after that succeeds, so the portfolio never describes a state that is not live yet.
  Homework Central waits for its CI `workflow_run`; Flinstone and KeyQuorum wait for
  their deploy jobs.

## Linking rules for agents

- To read a project's facts, read `scripts/project-sources.mjs` and the generated files.
  Do not copy numbers out of another repository into prose. DESIGN.md R15 and R16 apply:
  every figure must trace to the résumé or to public git history.
- To embed another project's live build, add its origin to `src/apps.ts` and mount it
  with a `data-guest` element. Do not hard-code a host into a page.
- Never make the portfolio name a relay, admin, or Worker host of another project. Those
  are operator surfaces. KeyQuorum's own rules forbid naming them from the lab or the
  site (see [`keyquorum.md`](keyquorum.md)).
- Changes that belong in another repository go to that repository. This repository's
  agents may read the others, and may propose a patch for them, but must not push to
  them. Access to other repositories is read-only unless a human attaches one with push.
