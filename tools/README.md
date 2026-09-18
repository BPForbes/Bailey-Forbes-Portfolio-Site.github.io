# tools/

Development helpers. Nothing in here is deployed — see `.assetsignore`.

## icons.json

The subset of [Font Awesome Free](https://fontawesome.com) 6.7.2 that this site
uses, extracted from the `@fortawesome/fontawesome-free` package (a
devDependency) with `tools/extract-icons.mjs`.

Icons are inlined as `<svg class="icon">` at each use site rather than loaded
from a CDN. The whole library is roughly 1.4 MB of webfonts plus its stylesheet;
the twenty-one icons actually used are about 9 KB of path data, they inherit
`currentColor`, and they need no third-party request at runtime (DESIGN.md R29).

Icon shapes are CC BY 4.0. Attribution is in the site README.

To add an icon: add its name to `extract-icons.mjs`, run
`node tools/extract-icons.mjs`, then paste the markup from `icons.json`.

## Project metadata

`projects.registry.mjs` is the single source of truth for the projects this site
represents. `generate-project-metadata.mjs` iterates it and writes
`data/projects.generated.json` during the Pages build; the frontend reads only
that file, so no page queries the GitHub API at runtime.

- `npm run generate:metadata` — refresh from GitHub (needs `GITHUB_TOKEN`)
- `npm run validate:metadata` — re-check the file on disk
- `npm run test:metadata` — hermetic tests, no network

The generated file is gitignored: it ships inside the deployment artifact and is
never committed, which is what stops a project notification from looping back
into another deployment.

See [`docs/project-metadata.md`](../docs/project-metadata.md) for the full flow,
the required secrets, and how a new project is onboarded.
