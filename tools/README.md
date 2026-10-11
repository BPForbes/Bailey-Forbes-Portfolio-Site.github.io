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

## contrast.py

Every role-token pair that carries text, a control boundary or a focus ring,
in all four renderings (dark / paper × standard / high contrast), against its
WCAG 2.2 AA floor. The values are the table in DESIGN.md B1; update both
when a token changes. `python3 tools/contrast.py` exits non-zero on a failure.

## audit-a11y.mjs

The rendered-page audit DESIGN.md B5 describes: text contrast against the
real painted background, standalone target sizes, horizontal overflow, focus
rings, console errors and the Display control's keyboard behaviour, on every
page, in every rendering, at 320 / 768 / 1280 px. Needs a server on port
4173 (`python3 -m http.server 4173`) and Playwright with Chromium:

```bash
NODE_PATH=$(npm root -g) node tools/audit-a11y.mjs
```

Items it reports as `UNFOCUSABLE` inside a closed `<details>` are expected.
