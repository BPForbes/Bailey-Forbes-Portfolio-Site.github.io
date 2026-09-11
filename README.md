# Bailey Forbes — portfolio

Static site for [bailey-forbes.com](https://bailey-forbes.com), deployed with GitHub Pages.

The copy is written from Bailey’s résumé plus **public git history** on [BPForbes](https://github.com/BPForbes): commit subjects, merged pull requests, and Flinstone `version/entries` GM=1 notes (compiled 11 Sep 2026).

## Local preview

```bash
npm ci
npm run build
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Layout

| Path | Purpose |
|------|---------|
| `index.html` | Home, experience, education |
| `projects/` | Expanded project write-ups |
| `timeline.html` | Cross-repo release ledger |
| `src/` | TypeScript source (`data.ts`, `site.ts`, `types.ts`) |
| `js/` | Compiled ES modules served by Pages |
| `CNAME` | `bailey-forbes.com` |
