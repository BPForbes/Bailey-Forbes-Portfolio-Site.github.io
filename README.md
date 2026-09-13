# Bailey Forbes — portfolio

Static site for [bailey-forbes.com](https://bailey-forbes.com), deployed with GitHub Pages.

The copy is written from Bailey’s résumé plus **public git history** on [BPForbes](https://github.com/BPForbes): commit subjects, merged pull requests, and Flinstone `version/entries` GM=1 notes (compiled 11 Sep 2026).

## Local preview

```bash
npm ci
npm run build
python3 -m http.server 4173
```

Open `http://localhost:4173/home/`.

## Routes

GitHub Pages serves each folder’s `index.html` without showing the filename. Old `.html` paths redirect.

| URL | Page |
|-----|------|
| `/` | Redirects to `/home/` |
| `/home/` | Home, experience, education |
| `/projects/` | Project index |
| `/projects/qpu/` | QPU (live lab) |
| `/projects/flinstone/` | Flinstone Kernel (lab chrome) |
| `/projects/keyquorum/` | KeyQuorum (lab chrome) |
| `/projects/homework-central/` | Homework Central |
| `/projects/emr/` | Electronic medical record |
| `/timeline/` | Individual timeline per project |

## Layout

| Path | Purpose |
|------|---------|
| `home/index.html` | Home, experience, education |
| `projects/` | Project write-ups; Flinstone, KeyQuorum, and QPU each host their own lab window |
| `timeline/` | Individual timeline per project |
| `src/` | TypeScript source (`apps.ts`, `data.ts`, `guestWindow.ts`, `routes.ts`, `site.ts`, `types.d.ts`) |
| `js/` | Compiled ES modules served by Pages |
| `CNAME` | `bailey-forbes.com` |
