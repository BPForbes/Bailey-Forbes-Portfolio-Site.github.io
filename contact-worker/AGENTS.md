# AGENTS.md — Contact API

A separate Cloudflare Worker, `portfolio-contact`. It validates the form, checks Turnstile, and sends one email through Resend. It is not part of the static site and has no route on the domain.

## Rules for this folder

- Run `node --test contact-worker/index.test.mjs` after any change. The file is outside `npm test`'s glob.
- Validate the Wrangler config with a dry run before a deploy:
  `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config contact-worker/wrangler.jsonc`.
- Secrets (`TURNSTILE_SECRET`, `RESEND_API_KEY`) are set with `wrangler secret put`. Never write one into `wrangler.jsonc`, a `.dev.vars` file, a test, or a log line.
- The API enforces exact hostnames and the action `contact` itself. Do not relax either, even though the Turnstile dashboard entry is less strict.
- `CONTACT_FROM` must match the verified Resend domain. Do not change it to an unverified address.
- Deploying this Worker is a human step. Do not run `wrangler deploy` without a request to do it.

## Related instruction files

These files refer to each other. A change to one that affects another should update both.

- [`AGENTS.md`](../AGENTS.md): the contact API
- [`contact-worker/CLAUDE.md`](CLAUDE.md): Claude Code imports this file
- [`docs/agents/deployment.md`](../docs/agents/deployment.md): the contact API runbook and deploy rules
