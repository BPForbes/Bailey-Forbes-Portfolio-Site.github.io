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
