# Portfolio contact API

Separate from Flintstone and the static-assets Worker. DNS remains at Namecheap;
the website remains on GitHub Pages. Only the `portfolio-contact` workers.dev
address receives this API. No zone routes or custom domains are configured.

Before deployment, verify the sending domain in Resend using its DNS records at
Namecheap. Set `TURNSTILE_SECRET` and `RESEND_API_KEY` as encrypted Worker secrets.
Never put their values in files, source, logs, or the frontend. Use a Resend
sending-only key scoped to the verified domain.

The recipient is the existing public portfolio contact address. Adjust
`CONTACT_FROM` to match the verified Resend domain before deployment.

Validate: `node --test contact-worker/index.test.mjs` and
`node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config contact-worker/wrangler.jsonc`.
Deploy only this config after secrets and sender verification are ready.

Cloudflare widget: bailey-forbes.com contact form, Managed mode, configured
hostnames bailey-forbes.com and www.bailey-forbes.com, pre-clearance disabled.
The API separately enforces exact hostnames and action `contact`, since a
Turnstile hostname entry also permits subdomains.
