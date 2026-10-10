# KeyQuorum: Cloudflare setup and the kq file system

KeyQuorum is the project with the most moving parts, so it has its own reference.
The code lives in `BPForbes/KeyQuorum`, which this agent can read but not push to.
The authoritative rules are that repository's own `CLAUDE.md` and `AGENTS.md`. This
page is a map of them and of what the portfolio shows. Root instructions:
[`AGENTS.md`](../../AGENTS.md). Linking rules: [`multi-repo.md`](multi-repo.md).

## What it is

A Rust crate for secure file sharing built on hardware keys. A file's data key is
split into a tree of shares; unlocking requires a quorum of registered hardware keys
(USB tokens) rather than one password. Two command-line tools, `keyquorum` and
`keyquorum-device`, do the work. A sealed mailbox relay carries envelopes between
people without the relay ever holding a secret.

## Where things are

| Path in `BPForbes/KeyQuorum` | What it is |
|---|---|
| `src/` | The crate. `src/envelope.rs` is the only sealed-envelope framing; `src/package.rs` is the signed setup package; `src/relay/` is the mailbox relay core; `src/provider/` is provider recovery |
| `lab/` | The browser lab: the same crate compiled to WebAssembly, served from GitHub Pages at `bpforbes.github.io/KeyQuorum/` |
| `workers/` | The Cloudflare side: the public relay Worker, its Durable Object, and the operator console (`workers/admin/`) behind Cloudflare Access |
| `deploy/cloudflare/terraform/` | Infrastructure as code for the zone rules, the R2 buckets, and Access |
| `docs/operator/` | The operator runbooks, including `relay-hosting.md`, `relay-deployment.md`, `relay-secrets.md`, `r2-blobs.md`, `r2-backups.md`, `admin-preview.md` |
| `docs/` (`.tex`) | The CLI manual and the lab manual |
| `.github/workflows/` | `deploy-lab.yml` (lab to Pages), `workers.yml` (Worker deploys), `tests.yml`, `security.yml`, `notify-portfolio.yml` |

## Cloudflare setup

Everything below is hosted on Cloudflare, and nothing else. The decision and its
record are in `docs/operator/relay-hosting.md`.

**The relay Worker** (`workers/wrangler.toml`, Worker name `keyquorum-relay`, staging
is `[env.staging]` as `keyquorum-relay-staging`):

- One Durable Object class, `RelayObject`, with a SQLite-backed migration. It holds the
  audit hash chain, the key tables, and the key-delivery letters together, because they
  are written together.
- An R2 binding `LETTERS` (bucket `keyquorum-letters`) for large sealed letters. The
  bucket is private, has no custom domain, and is bound to this Worker only.
- An R2 binding `BACKUPS` (`keyquorum-backups`) for sealed backups written by the alarm,
  sealed to a key only the operator holds.
- A rate limiter binding `RATE_LIMITER`, keyed on the client IP.
- No route in the file. The hostname is a Worker custom domain managed in Terraform, and
  `workers_dev` is off. Preview URLs are on for this Worker only, and the Worker answers
  404 on any host not in `ALLOWED_HOSTS`, including a Version URL.

**Secrets and deploy variables. Never in a file or in GitHub secrets:**

- `RELAY_PRIVATE_KEY` and `RELAY_CERTIFICATE` are Worker secrets, set with
  `wrangler secret put`. The certificate is `provider.kqcert`, base64-encoded.
- `PROVIDER_ROOT` (the pinned provider root public key) and `BACKUP_RECIPIENT` are deploy
  variables, supplied from the GitHub environment at deploy time. They never go in
  `wrangler.toml`.
- `ALLOWED_HOSTS` is set at deploy from the environment's `RELAY_URL`.
- The `kql_` operator lock and the provider root key never go on a Worker.
- `scripts/guard.mjs` fails CI if the config or the built bundle holds key material, a
  secret-like `[vars]` name, a wildcard host outside `[previews.vars]`, or a Durable
  Object migration that deletes or renames a class. That last one destroys data.

**The operator console** is a separate Worker (`workers/admin/`), mounted at
`/relay/admin` (or `/relay/staging-admin`), behind Cloudflare Access with MFA. The
Worker verifies Access's signed token (`src/access.js`). A preview of the console is
described in `docs/operator/admin-preview.md`.

**Mounts and origins.** All four surfaces share one hostname, `keyquorum.dev`:
`/relay` and `/relay/staging-user` for the relays, `/relay/admin` and
`/relay/staging-admin` for the consoles. The mount is non-secret (`MOUNT_PATH`).
The relay's routes are Workers routes in Terraform.

**Browser isolation.** The relay refuses cross-site browser requests (`Sec-Fetch-Site`,
foreign or `null` `Origin`). Every answer carries `Cross-Origin-Resource-Policy:
same-origin`, `X-Frame-Options: DENY`, and `Cross-Origin-Opener-Policy: same-origin`.
The lab's relay is in-process at a name that is never served. **Neither the lab nor
this portfolio may name a relay host.**

**Environments and deploys.** `workers.yml` deploys to GitHub environments
`cloudflare-staging` and `cloudflare-production`. Each holds one Cloudflare credential,
the Workers-deploy token and account ID. No third-party deploy action is used. The
`workers` job is the stable check.

**Status, as recorded in the repository (2026-10-09).** Production deployment and
initial setup are evidenced in `docs/operator/admin-preview.md`. Full live acceptance is
**not** complete: issuance, enrollment, rotation, recovery, restore, overload, and
staging acceptance are unverified. Do not claim they passed. Say "deployed, acceptance
pending" unless the evidence in that file says otherwise.

## The kq file system

Two things are called "the file system", and they are different.

### 1. The lab's file system (what the portfolio shows)

The browser lab is a small sandboxed machine. Each person in the seeded organisation
has:

- their own drive and their own SQLite store;
- a Windows-Explorer-style file browser (folders, sortable list, Properties, a viewer);
- mock USB drives mounted under `/media`, which can be inserted, ejected, or moved.

Every button and every terminal line runs the real `keyquorum` or `keyquorum-device`
command, compiled to WebAssembly. The terminal accepts any such line. The mock drives'
passphrases are published demo values and are safe to show. The lab's relay answers in
the page. The site's guest window for it is mounted with `data-guest="keyquorum"`, and
the URL is in `src/apps.ts`.

### 2. The on-disk kq formats (the wire formats)

These are binary formats with a magic and a version. **Magics and kind bytes are wire
format. Append new ones; never renumber or reuse one.**

| Extension (magic) | What it is |
|---|---|
| `.kqpb` (`KQPB`) | A sealed envelope, the mailbox passport. The relay carries these. Never commit one |
| `.kqpkg` (`KQPK` v1) | A signed setup package: an issuer signature over a purpose, a validity window, and components |
| `.kqxb` (`KQXB`) | An export bundle, and the client setup manifest (type 6) and the provider recovery payload (type 5) |
| `.kqcert` | A provider certificate (`provider.kqcert`). Never commit one |
| `.kqreq` (`KQRQ` v1) | A client's public enrollment request |
| `.kqrl` (`KQRL`) | Relay key material, one of the artifacts the source names. Never commit one |
| `.kqpolicy` | A policy file. Never commit one |
| `.kqbn` | An eviction notice |
| transfer package (`KQTX`) | Signed by the source device and bound to the destination. Its extension is not stated in the source; check before naming one |
| `device.kq` (`KQDV`) | A device record, signed by `device.skey` |
| slot tokens (`KQST`) | Per-slot tokens |
| `KQBS` | A signature artifact |

Rules the source enforces, which agents here must respect when reading or writing:

- Envelopes are framed only in `src/envelope.rs`. Add a `Format` there; do not re-roll
  the framing in a new module.
- A `.kqpkg` component is dispatched by its own magic and kind, never by a name or the
  package's claim. Anything else, or anything the purpose does not allow, is refused
  before any write.
- The personal store's install ledger keys every install by stream. A package's
  generation must rise. A `ClientSetup` never replaces a stored key; only a newer
  `ClientUpdate` may.

## Rules for agents

- Read the KeyQuorum repository's `CLAUDE.md` and `AGENTS.md` before proposing a change
  there. They include a strict review standard with SOC 2 criteria, a versioning lock,
  and rules for `version/locked/`, `version/entries/` and `.ver` files.
- Do not commit a bearer, a `.kqpb`, a `*.kqcert`, a `*.kqrl`, a `*.kqpolicy`, a provider
  root key, or a relay database. Those rules are stated in that repository too.
- Do not put a relay host, a key, or a secret into this portfolio, into the lab copy, or
  into a page.
- A claim about KeyQuorum on the site must match its own docs. The site says "early
  scaffolding" and "deployed, acceptance pending" where the evidence says so. Do not
  upgrade either.
