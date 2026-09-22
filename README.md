# Bailey Forbes — portfolio

Static site for [bailey-forbes.com](https://bailey-forbes.com), deployed with GitHub Pages.

The copy is written from Bailey’s résumé plus **public git history** on [BPForbes](https://github.com/BPForbes): commit subjects, merged pull requests, and Flinstone `version/entries` GM=1 notes. Language splits, commit counts, versions and recent milestones are refreshed automatically from the GitHub API — see [Project data](#project-data).

## Design rules

[`DESIGN.md`](DESIGN.md) is the guide this site's UI is built to. Part A is the
general rule set (R01–R30); Part B records the project brief, the semantic token
roles in `css/styles.css`, which container each kind of content gets, the
exceptions that were granted and why, and exactly what was and was not verified.
Read it before changing layout, tokens, or component behaviour.

## Project evidence

The QPU and Homework Central screenshots and the Flinstone and KeyQuorum
transcripts on the project pages come from building and running those
repositories locally; each caption names the commit and the capture date.
Homework Central's first two are a live run of its ASP.NET Core API,
PostgreSQL database and React frontend together, signed in as the
repository's own seeded development personas: one shows general chat, a
message with real Markdown and LaTeX, and a reply from a second account with
an `@mention`; the other shows that mention's notification in the recipient's
own inbox. The third is a separate run of its unmerged neural-net branch,
showing the moderation model's real architecture and 3D mesh rather than a
trained result — see DESIGN.md B5 for what that branch needs that this
environment doesn't have. The EMR has no screenshot because its tree is not
public, so there is nothing to run.

## Hosting and TLS

`bailey-forbes.com` is served over HTTPS; the certificate is issued and renewed
by the host, so there is nothing to rotate by hand. GitHub Pages is the current
origin for the custom domain (see [`CNAME`](CNAME)); the same tree also
publishes to Cloudflare Workers as static assets via
[`wrangler.jsonc`](wrangler.jsonc), with preview branches going out through
`wrangler versions upload`. The Flinstone lab's shared relay runs as a
Cloudflare Durable Object on its own subdomain.

## Credits

Icons are [Font Awesome Free](https://fontawesome.com) 6.7.2 — icon shapes
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Only the icons this
site uses are inlined; see [`tools/README.md`](tools/README.md).

## Local preview

```bash
npm ci
npm run build
python3 -m http.server 4173
```

Open `http://localhost:4173/home/`.

TypeScript in `src/` is the source of truth. `npm run build` (`tsc`) emits ES modules into `js/` for the browser; that folder is gitignored. Pages and Cloudflare Workers Builds compile it on deploy, so you do not commit a second handwritten copy of each file.

Cloudflare Workers Builds uses [`wrangler.jsonc`](wrangler.jsonc) to publish this tree as static assets after `npm run build`. Preview branches run `npx wrangler versions upload`. GitHub Pages remains the current host for `bailey-forbes.com` until that custom domain is attached to the Worker.

## Project data

Project data comes from two places, and the split between them is deliberate.

**Curated — `src/data.ts`.** Hand-written prose: the project blurbs, the
engagement history, the descriptive chips, and every timeline entry written by a
person. The sync never edits this file.

**Generated — `data/project-metadata.json` and `src/generated/projectMetadata.ts`.**
Facts read back from GitHub. Both files are written by
`scripts/sync-project-metadata.mjs` and carry a do-not-edit header; the JSON is
the durable snapshot, the TypeScript module is its typed projection for the
browser build.

`src/projectMetadata.ts` merges the two at runtime. Generated data wins for
repository facts; curated copy wins for anything written by a person.

### What is automated

| Field | Source |
|-------|--------|
| Language names, byte counts, percentages | GitHub `GET /repos/{owner}/{repo}/languages` (Linguist), percentages derived from the byte counts |
| Commit count on the default branch | `GET /repos/{owner}/{repo}/commits?per_page=1`, read from the `rel="last"` link — one request, no history download |
| Merged pull request count | `GET /repos/{owner}/{repo}/pulls?state=closed`, filtered to merged |
| Current version | Newest published release → highest stable semver tag → repository version manifest |
| Recent timeline milestones | Merged pull requests and published releases that clear the significance bar below |

### What stays manual

- Every descriptive chip that is not a repository fact: `Networking`,
  `PostgreSQL`, `Docker`, `Vite`, `Creator`, `Lead`, `Solo build`,
  `Team of five`, `HIPAA testing`. These describe the work, not the tree, and
  GitHub cannot know them.
- All curated timeline prose in `src/data.ts`.
- Everything about the **EMR**, which has no public repository. Its page says so,
  and its language split is explicitly labelled an estimate.
- Résumé figures such as the "11 core kernel releases" count.
- The captured shell transcripts on the project pages, which are records of a
  real session and are not re-derived.

### Where the mapping lives

`scripts/project-sources.mjs`, and nowhere else:

```js
export const PROJECT_SOURCES = {
  flinstone: { repo: "BPForbes/Bailey-Forbes-Flinstone", … },
  qpu: { repo: "BPForbes/BPForbes.QPU.github.io", … },
  "homework-central": { repo: "BPForbes/Homework-Central" },
  keyquorum: { repo: "BPForbes/KeyQuorum" },
};
```

**To add a future project:** publish its page as usual, then add one entry here
with its `repo`. Nothing else needs editing — the sync picks it up, the language
bar and chips start resolving, and a project id that is not a published
portfolio project is rejected rather than silently generated.

**To remove one:** delete its entry. The next sync drops its snapshot, and the
site falls back to whatever `src/data.ts` says about it.

### Projects that publish their own metadata

Flinstone and QPU each generate a `project-metadata.json` (schemaVersion 1)
inside their own validated build and publish it with their GitHub Pages
deployment. Flinstone's `docs/project-metadata.md` states the intent directly:
that repository is the source of truth for its own state, and the portfolio
should not maintain a second copy of it.

Where a project declares a `contractUrl`, the sync prefers that document over
re-deriving the same facts from the REST API. If it is unreachable, the wrong
schema, or describes a different repository, the run logs the reason and falls
back to the REST API, which produces the same normalized shape. A contract is an
improvement in provenance, never a dependency.

### Timeline significance

The timeline is a curated history, not `git log`, so the default answer for any
given pull request is no. Individual commits are never entries.

An entry has to look like a milestone: `feat:`, `release:`, `perf:`,
`security:`, `major:`, `milestone:`, `architecture:`, a conventional type marked
breaking with `!`, or prose about adding, introducing, implementing, shipping,
rewriting or hardening something. Everything unmatched is dropped.

Dropped outright: dependency bumps, `chore`/`ci`/`docs`/`style`/`test`/`refactor`
prefixes, merges, reverts, typo and formatting work, documentation-only changes,
version-lock commits, bot-authored chores, and review-bot chatter. Two of those
are worth spelling out:

- A `fix:` is a repair, not a milestone, so a fix cannot qualify by mentioning
  "migration" or "architecture" in passing.
- Documentation is excluded by title, however phrased — "Add README with local
  dev setup instructions" does not qualify on the word "Add". The documentation
  noun has to be what the verb acts on, so "Add a docs generator to the build"
  is still eligible. This is a title test rather than a per-pull-request file
  listing, which would cost an extra API request for every candidate.

Drafts and prereleases are never milestones, on either the REST or the contract
path.

Two rules keep generated entries from trampling written ones:

1. An entry matching a curated one — by link, or by the same project, date and
   normalised title — loses to the curated copy.
2. A generated entry falling inside the period the curated entries already cover
   for that project is dropped. That window is written by hand, in better prose.
   Curated dates are mixed precision — the EMR engagement is recorded by month —
   so a month-granular entry protects its whole month.

So generation extends the timeline forward and leaves the written history alone.
Today that means the 50 curated entries are untouched and one generated entry
sits on top of them.

### Running the sync

```bash
npm run sync:metadata                     # refresh everything
npm run sync:metadata -- --project qpu    # one project
npm run sync:metadata:check               # report drift, write nothing, exit 1 if stale
```

Every repository is public, so an unauthenticated run works against GitHub's
60-requests/hour budget. Export `GITHUB_TOKEN` for a comfortable one. Tokens are
sent as request headers only — never written into generated files, logs, or
anything the browser receives.

### Scheduled syncing

[`.github/workflows/sync-project-metadata.yml`](.github/workflows/sync-project-metadata.yml)
runs daily at 05:20 UTC, and on demand from the Actions tab (optionally for a
single project). It installs, syncs, runs `npm test` against the fresh data, and
commits `chore(portfolio): sync project metadata` **only if the generated files
actually changed** — the run-to-run timestamps are ignored when deciding that, so
a quiet day produces no commit and no deployment.

It reads with the workflow's own `GITHUB_TOKEN`; the repositories are public, so
no PAT is needed. A `PORTFOLIO_GITHUB_TOKEN` secret is honoured if one is ever
set, for a project repository that turns private.

`main` only accepts changes through a pull request, so the commit is pushed with
a write deploy key (`SYNC_DEPLOY_KEY`) that the ruleset's bypass list allows.
That push raises a normal push event, so `static.yml` deploys the site and
`typecheck.yml` runs; this workflow has no push trigger, so the chain ends there.
Setup is in [`docs/project-metadata.md`](docs/project-metadata.md#pushing-past-the-pull-request-rule).

### Notifying the portfolio immediately

A project repository can push an update the moment it ships, instead of waiting
for the next scheduled run:

```bash
curl -X POST \
  https://api.github.com/repos/BPForbes/Bailey-Forbes-Portfolio-Site.github.io/dispatches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"event_type":"portfolio-project-updated"}'
```

`$TOKEN` needs `contents: write` on this repository. This is entirely optional —
the daily schedule covers the same ground within a day.

### When GitHub is unavailable

The site must not degrade because an API call failed, so the sync never
publishes an absence as a fact:

- A repository that fails to fetch keeps its **previous** snapshot, untouched.
  The failure is reported in the run log, not written into the published file —
  so an outage produces a byte-identical snapshot, and therefore no commit and
  no redeploy.
- A repository that fails with no previous snapshot is omitted entirely, and the
  site falls back to the curated values in `src/data.ts`.
- A languages response with no positive bytes is refused rather than published
  as an empty bar.
- Generated output is validated before it is written: percentages must sum to
  100, counts must be non-negative integers, a fresh zero commit count is
  rejected, URLs must be GitHub URLs, dates must parse, project ids must be
  published projects, and timeline identities must be unique. A document that
  fails validation is not written at all.
- A malformed field inside a reachable contract — a release link that is not a
  GitHub URL, say — is discarded during normalization rather than overlaid onto
  otherwise valid data. Left in, it would fail the whole document and stop every
  later scheduled refresh.
- Both generated artefacts are checked for drift, not just the JSON. If the
  TypeScript module is deleted or hand-edited while the snapshot is current, the
  next sync notices and rewrites it instead of reporting "no change" and leaving
  the build broken.

So "0 commits", "0%", and "unknown version" are not reachable states.

### Tests

```bash
npm test      # builds first, then runs tests/
```

Covers the percentage maths and rounding, languages appearing and disappearing,
single- and many-language repositories, unknown-colour fallback, version
precedence and semver extraction, commit-count parsing, timeline significance
and deduplication, contract parsing, malformed API responses, and the
API-failure path that preserves existing data. No test touches the network —
every GitHub response is injected through a fake transport.

## Routes

GitHub Pages serves each folder’s `index.html` without showing the filename. Old `.html` paths redirect.

| URL | Page |
|-----|------|
| `/` | Redirects to `/home/` |
| `/home/` | Home, experience, education |
| `/projects/` | Project index |
| `/projects/qpu/` | QPU (live lab) |
| `/projects/flinstone/` | Flinstone Kernel (live lab) |
| `/projects/keyquorum/` | KeyQuorum (command line only — the page says so) |
| `/projects/homework-central/` | Homework Central |
| `/projects/emr/` | Electronic medical record |
| `/timeline/` | Redirects to `/projects/` |
| `/404.html` | Not found, with a list of every real page |

## Layout

| Path | Purpose |
|------|---------|
| `home/index.html` | Home, experience, education |
| `projects/` | Project write-ups; Flinstone and QPU load live guests from GitHub Pages; KeyQuorum has no web build and its page states that rather than showing an empty window |
| `projects/*/index.html` | Project write-up and that project’s timeline |
| `src/` | TypeScript source (`apps.ts`, `data.ts`, `deck.ts`, `guestWindow.ts`, `icons.ts`, `languageColors.ts`, `projectMetadata.ts`, `routes.ts`, `site.ts`, `types.d.ts`) |
| `src/generated/` | Written by the sync; do not edit by hand |
| `scripts/` | `sync-project-metadata.mjs` and its libraries; the project→repository mapping lives in `project-sources.mjs`. Not deployed |
| `tests/` | Unit tests for the sync and the merge layer (`npm test`). Not deployed |
| `data/project-metadata.json` | Generated snapshot of GitHub facts, and the fallback the next sync reads |
| `tools/` | Dev-only helpers; not deployed. Font Awesome subset extraction |
| `css/styles.css` | The only stylesheet. Components use the semantic role tokens; see DESIGN.md B1 |
| `DESIGN.md` | UI/UX rules, the project brief, token roles, and the verification record |
| `js/` | Generated by `tsc` — not in git; Pages and local preview compile it |
| `CNAME` | `bailey-forbes.com` |
| `wrangler.jsonc` | Cloudflare Workers static-asset deploy (`bailey-forbes-portfolio-site-github-io`) |
