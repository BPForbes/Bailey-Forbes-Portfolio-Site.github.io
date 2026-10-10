# Deployment

Read this before changing workflows, Wrangler configuration, DNS-facing files, or
anything that decides what is published. Root instructions: [`AGENTS.md`](../../AGENTS.md).

## What is deployed, and where

| Thing | Config in this repo | Published to | Trigger |
|---|---|---|---|
| The static site (this repo) | `.github/workflows/static.yml` | GitHub Pages, the current origin for `bailey-forbes.com` (`CNAME`) | Push to `main` |
| The same tree as Workers static assets | `wrangler.jsonc` (root), `.assetsignore` | Cloudflare Workers, not yet the live domain | Cloudflare Workers Builds, connected to this repository |
| Contact API | `contact-worker/wrangler.jsonc`, `contact-worker/index.mjs` | `portfolio-contact.<account>.workers.dev` only | Manual `wrangler deploy`, after secrets and sender are ready |
| Typecheck | `.github/workflows/typecheck.yml` | Nothing; it gates pull requests and pushes | Pull request and push to `main` |
| Metadata refresh | `.github/workflows/sync-project-metadata.yml` | Commits generated data, which then deploys | Daily, manual, or `portfolio-project-updated` |

## GitHub Pages (the live site today)

`static.yml` runs on every push to `main`:

1. `npm ci`
2. `npm run build`: `tsc --noEmit`, then `tools/build.mjs`, which bundles `js/`,
   vendors KaTeX into `css/vendor/`, and emits `modules/` for the tests
3. `actions/upload-pages-artifact` with `path: '.'`, so the whole repository root is
   published, not just a build folder
4. `actions/deploy-pages`

Consequence: anything committed to the repository root is public at its path. That
includes `AGENTS.md`, `CLAUDE.md`, and everything under `docs/`. Do not put secrets,
tokens, account credentials, or private notes anywhere in the tree. The Cloudflare
account identifier in `contact-worker/wrangler.jsonc` is already public.

`npm run build` must pass before publishing. A failed build leaves the previous
Pages tree in place.

## Cloudflare Workers (the static assets Worker)

Root `wrangler.jsonc`:

- Name `bailey-forbes-portfolio-site-github-io`, assets directory `.`,
  `html_handling: auto-trailing-slash`, `not_found_handling: 404-page`.
- `preview_urls: true`, so branch previews get their own URL.
- `.assetsignore` keeps out of the Worker's assets: `.git`, `.github`, `.claude`,
  `node_modules`, `modules`, `src`, `tests`, `tools`, `scripts`, `contact-worker`,
  the package files, and the `.env` and `.dev.vars` family. Add a path there when a
  new folder should never be served. Note that `.assetsignore` only affects this
  Worker; it does not change what GitHub Pages publishes.

Workers Builds runs `npm run build` and then publishes. For a branch, the README's
preview command is `npx wrangler versions upload`. Do not run `wrangler deploy` for
the static site by hand.

The live domain is still GitHub Pages. Moving `bailey-forbes.com` to the Worker is a
DNS and custom-domain change made in the Cloudflare dashboard, which is not in this
repository. Do not change `CNAME` on your own.

## The contact API

`contact-worker/README.md` is the runbook. In short:

- The API is separate from the site and from every project. It answers only at the
  `portfolio-contact` workers.dev address. It has no routes and no custom domain.
- Secrets `TURNSTILE_SECRET` and `RESEND_API_KEY` are encrypted Worker secrets, set
  with `wrangler secret put`. Never in a file, a log, or the frontend. The Resend key
  is sending-only and scoped to the verified domain.
- `CONTACT_FROM` must match the verified Resend domain before a deploy. The sender
  verification is an owner step at Namecheap and Resend.
- Validate before deploy: `node --test contact-worker/index.test.mjs`, then
  `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config contact-worker/wrangler.jsonc`.
- Turnstile is configured for `bailey-forbes.com` and `www.bailey-forbes.com` in managed
  mode, with pre-clearance off. The API enforces exact hostnames and the action `contact`
  on its own, because a Turnstile hostname entry also admits subdomains.
- The contact form is not published until the sender is verified and the key is set.
  See the "Contact form addition" note in `DESIGN.md`.

## Flinstone's Cloudflare pieces (other repository, listed for linking)

- A Worker `flintstone-lab` in `BPForbes/Bailey-Forbes-Flinstone/infra/cloudflare`,
  routed to `flintstone.bailey-forbes.com`. It proxies the lab and holds a Durable Object
  per chat room.
- The portfolio's parent page needs cross-origin isolation headers (COOP, COEP
  `credentialless`, Permissions-Policy) so the lab's iframe can boot. Those are Transform
  Rules set in the Cloudflare dashboard. They are not in this repository, so an agent
  cannot see or verify them here. If the lab stops attaching, check that dashboard setting
  before changing any file in this repository.

## KeyQuorum's Cloudflare pieces (other repository)

See [`keyquorum.md`](keyquorum.md). The relay and console are Workers in that repository,
deployed by its `workers.yml` under GitHub environments `cloudflare-staging` and
`cloudflare-production`. This repository never deploys them.

## Checks before any deploy-facing change

```bash
npm ci
npm run build                       # typecheck and bundle
npm test                            # node:test suite, runs the build first
node --test contact-worker/index.test.mjs
python3 -m http.server 4173         # then open http://localhost:4173/home/
```

Then run `tools/audit-a11y.mjs` and `tools/contrast.py` when the layout or tokens change
(see `tools/README.md`).

## Rules

- Work on a branch and open a pull request. `main` is protected by a ruleset. The
  metadata job is the only automation allowed past it, through its deploy key.
- Never edit generated files by hand. See the list in [`AGENTS.md`](../../AGENTS.md).
- Never publish a number the repository cannot trace. The footer dates and the
  "compiled on" line come from the build and the sync, and must stay that way.
- A workflow change touches a security boundary: the notify token, the deploy key, and
  the publish step. Keep `permissions` minimal, and never interpolate `${{ }}` values
  into a shell script that holds a token.
