# Project metadata automation

How a change in a project repository becomes fresh numbers on bailey-forbes.com,
without a portfolio pull request, a manual commit, or a manual Actions run.

```
project repository changes on main
        ↓
project CI / build / deployment succeeds
        ↓
project sends repository_dispatch: project-updated
        ↓
portfolio receives it
        ↓
portfolio queries GitHub and regenerates data/projects.generated.json
        ↓
portfolio builds (tsc)
        ↓
portfolio deploys to GitHub Pages
```

Everything is gathered at build time, so the deployed site stays static: no page
on bailey-forbes.com talks to `api.github.com`, and nothing polls.

## The registry is the source of truth

`tools/projects.registry.mjs` lists every project the site represents. The
generator iterates it; nothing else enumerates projects.

```js
{
  id: 'flinstone',                                   // matches ProjectId in src/types.d.ts
  label: 'Flinstone Kernel',
  repo: 'BPForbes/Bailey-Forbes-Flinstone',          // null when there is no public repo
  liveUrl: 'https://bpforbes.github.io/Bailey-Forbes-Flinstone/',
  metadataEnabled: true,
  version: { from: 'file', path: '…', patterns: […] },
  milestones: [{ from: 'releases' }, { from: 'tags' }, { from: 'verEntries', path: 'version/locked' }],
}
```

## What is generated

`tools/generate-project-metadata.mjs` writes `data/projects.generated.json`
(schema version 1). Per project:

| Field | Source |
| --- | --- |
| `repo`, `repoUrl`, `defaultBranch`, `description` | `GET /repos/{owner}/{repo}` |
| `lastUpdated`, `pushedAt`, `createdAt` | same |
| `latestCommit` | `GET /repos/{owner}/{repo}/commits` |
| `stats.commits` | commit count, from the `Link: rel="last"` page number |
| `stats.mergedPullRequests` | closed pull requests with a `merged_at` |
| `stats.pullRequests` | every pull request ever opened |
| `languages[].bytes` | `GET /repos/{owner}/{repo}/languages` (Linguist) |
| `languages[].percentage` | derived from those bytes |
| `version` | registry-declared release tag or tracked file |
| `milestones[]` | releases, tags, and `.ver` rows (below) |

Language percentages are always computed from GitHub's byte counts, never
maintained by hand, so they move when the repository's balance moves.

Colours are **not** in this file. They are a design decision and live in
`src/languageColors.ts`, so nothing in the generated document is presented as
something GitHub reported.

## Timeline: which changes count as milestones

Not every commit is a portfolio milestone. The signals, in the order the
registry lists them, are all deterministic and repository-owned:

1. **GitHub Releases** — the strongest signal. Used automatically wherever
   published releases exist.
2. **Tags** — any annotated or lightweight tag that is not already a release.
3. **`.ver` rows** — a repository-owned metadata file. Flintstone publishes no
   releases or tags; `version/locked/*.ver`, written by its own version-lock
   automation on merge, *is* its release record, carrying a semver, a
   `RELEASE_DATE`, and release prose. `PRERELEASE=1` rows are excluded, because
   they are not published releases.

No commit-message heuristics are used anywhere.

### How generated milestones meet the curated timeline

`src/data.ts` holds a hand-written timeline: prose about work, including the
2021–2022 EMR engagement that has no repository at all. That writing is not
regenerated.

The merge rule is a cutoff, and it is exact:

> For each project, a generated milestone is shown only when its date is **newer
> than every curated entry** for that project. A project with no curated entries
> gets its whole generated history.

So the curated account stays exactly as written, generated milestones continue
it forward, and a release the author already described in their own words is
never restated by the generator. When Flintstone published 5.0.0 on 2026-09-17 —
after the newest curated Flintstone entry (4.5.4, 2026-09-15) — it appeared
automatically; the 24 older `.ver` rows did not disturb the curated history.

## Rendering

The frontend reads only `data/projects.generated.json`:

- `[data-lang-bar="<id>"]` — the language bar and legend.
- `[data-metric="<id>:<field>"]` — a repository number written into the markup
  that already showed it. `data-metric-suffix` carries the unit, so the chip
  still reads `398 commits`.
- `[data-repo-stats="<id>"]` — the statistics strip under a project page's
  language bar: version, commits, merged pull requests, latest commit (linked),
  and last updated. Rendered entirely from generated metadata.

Every project with a public repository carries a strip; the EMR page does not,
because it has no repository and its page already says its language split is a
recalled estimate rather than a measurement.

All of it degrades to the curated values in `src/data.ts`. A build without the
generated file — a plain `git clone` plus `npm run build` — renders exactly as it
did before this existed: authored chip text stands, the strips collapse via
`.repo-stats:empty`, and the timeline shows curated entries only.

A number is never blanked out or replaced with a placeholder, and the reverse
holds too: a `data-metric` element with **no** authored text is a placeholder
for a generated figure and removes itself when there is none, so no new
hand-maintained number is introduced. That is how the QPU and KeyQuorum cards
gained commit counts without anyone having to keep them current.

Languages below 0.5%, and anything past the sixth, are folded into an `Other`
segment so the bar still adds to the whole repository without the legend growing
to twelve rows.

## Failure behaviour

The generator fails loudly and writes nothing partial:

- A malformed API response throws, naming the repository.
- 403 distinguishes a rate limit from a permissions problem.
- 5xx is retried three times with backoff; anything else fails immediately.
- The document is validated before writing, written through a temporary file and
  renamed into place, then re-validated by re-reading the bytes that landed.
- The deploy workflow validates it once more before uploading the artifact.

**No stale cache is kept, deliberately.** If a repository cannot be read, the
deploy fails and the *previous* GitHub Pages deployment keeps serving. That is
the fail-closed choice: the site keeps showing the last numbers that were
verified correct, rather than a fresh deployment silently mixing current and
stale figures. Validation also refuses any document containing a token-shaped
string or an email address.

## Avoiding deployment loops

`data/projects.generated.json` is **gitignored**. It is written during the build
and uploaded inside the Pages artifact; it is never committed.

This is what makes a loop structurally impossible. The loop the design avoids is:

```
repository_dispatch → regenerate → commit → push main → deploy → regenerate → …
```

Since the deploy never pushes, there is no second trigger. The three entry
points — `push` to main, `repository_dispatch`, `workflow_dispatch` — all run the
same job, and none of them produces a commit. The `concurrency: pages` group
additionally collapses a burst of notifications: queued runs between the one in
progress and the latest are skipped, so ten projects publishing at once produce
one refresh, not ten.

## Secrets and permissions

| Secret | Where | Permissions |
| --- | --- | --- |
| `PORTFOLIO_DISPATCH_TOKEN` | each **project** repository | Fine-grained PAT, **only** `BPForbes/Bailey-Forbes-Portfolio-Site.github.io`, **Contents: Read and write**. Nothing else. |
| `METADATA_READ_TOKEN` | portfolio, **optional** | Only needed if a tracked repository becomes private. `Contents: Read` on those repositories. |

`Contents: write` is what GitHub requires for the `POST /repos/{owner}/{repo}/dispatches`
endpoint; it is the narrowest permission that endpoint accepts. The token
reaches no repository other than the portfolio.

The portfolio side needs **no** extra secret today: every tracked repository is
public, so the workflow's own `GITHUB_TOKEN` can read them, which is why
`permissions:` there is just `contents: read` plus what Pages needs.

The token is passed to the notifier as a secret, read from the environment
rather than interpolated into a command line, never echoed, never written to the
generated file, and never shipped to the browser. The reusable notifier declares
`permissions: {}` — it needs no access to the repository calling it.

### Why not something more native

There is no credential-free option for this: `GITHUB_TOKEN` is scoped to the
repository whose workflow it runs in, and cannot dispatch an event to another
repository. Cross-repository notification requires a credential of some kind.

The closest native alternative is a **GitHub App** with an installation token
minted per run by `actions/create-github-app-token`. That token is short-lived
(one hour) rather than long-lived, which is a genuine improvement, and it is
worth moving to if the number of project repositories grows.

It is not the default here because the trade is narrower than it looks: the App's
private key is itself a long-lived secret stored in every project repository, so
the number of long-lived secrets is unchanged, while the setup gains an App
registration, an installation, and two secrets per repository instead of one. A
fine-grained PAT already scopes to exactly one repository and one permission.
Because the dispatch lives in a single reusable workflow, switching later is a
change to one file:

```yaml
- uses: actions/create-github-app-token@v1
  id: token
  with:
    app-id: ${{ secrets.PORTFOLIO_APP_ID }}
    private-key: ${{ secrets.PORTFOLIO_APP_PRIVATE_KEY }}
    owner: BPForbes
    repositories: Bailey-Forbes-Portfolio-Site.github.io
```

## Which repository notifies on what

| Repository | Trigger | Why |
| --- | --- | --- |
| `BPForbes/BPForbes.QPU.github.io` | `workflow_run` on **Deploy static React QPU app** | That workflow publishes the workbench to Pages. Firing on push would advertise a state whose site is not live yet. |
| `BPForbes/Bailey-Forbes-Flinstone` | `workflow_run` on **Browser kernel artifact**, plus a gate job | See below. |
| `BPForbes/Homework-Central` | `workflow_run` on **CI** (push only) | No site of its own, but a commit that does not build should not move the numbers. |
| `BPForbes/KeyQuorum` | `workflow_run` on **Test** (push only) | `cargo test --all-targets --all-features` compiles everything Compile does, so it is the stronger gate. |

### How Flintstone avoids notifying before its deployment succeeds

"Browser kernel artifact" succeeding is not sufficient. Its `deploy` job is
conditional:

```yaml
needs.validate.outputs.bootable == 'true' &&
needs.validate.outputs.browser_compatible == 'true' &&
needs.validate.outputs.boot_smoke_passed == 'true'
```

A candidate that builds and tests cleanly but does not clear those promotion
gates records a blocked outcome, leaves `validate` green, and **skips** `deploy`
— the run's overall conclusion is still `success` while nothing was published.

So `notify-portfolio.yml` in Flintstone runs a `gate` job first, which asks
`GET /repos/{repo}/actions/runs/{id}/jobs` what the job named
*Publish validated lab to GitHub Pages* actually concluded, and notifies only on
`success`. A skipped job — which is how a blocked promotion looks from here —
stops the notification. It is fail-closed: anything other than an observed
successful publish means the portfolio does not move.

The other Flintstone workflows are deliberately not wired: **CI** runs on
develop and feature branches and validates versioning, **Version lock on merge**
pushes to develop and publishes no artifact, and **Deploy** is
`workflow_dispatch`-only and produces no Pages state.

## Onboarding a new project

1. Add an entry to `tools/projects.registry.mjs`.
2. Add `id` to `ProjectId` in `src/types.d.ts`, and a label plus a path in
   `src/data.ts` / `src/routes.ts` if the project gets its own page.
3. Copy `.github/workflows/notify-portfolio.yml` from the closest existing
   project into the new repository, changing the `workflows:` name it waits on
   and the `project:` id.
4. Add `PORTFOLIO_DISPATCH_TOKEN` to that repository's Actions secrets.

Step 1 plus step 3 are the automation; steps 2 and 4 are the page and the
credential.

## Running it locally

```sh
npm ci
npm run test:metadata                        # hermetic, no network
GITHUB_TOKEN=<a token with public repo read> npm run generate:metadata
npm run validate:metadata
npm run build
```

Without `generate:metadata`, the site builds and renders from the curated values
in `src/data.ts`, which is how pull-request typechecking runs.
