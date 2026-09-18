#!/usr/bin/env node
/**
 * Build the site's JavaScript, and vendor KaTeX's stylesheet and fonts.
 *
 * This replaced a plain `tsc` emit when commit cards started rendering with
 * react-markdown and KaTeX. Those are ordinary npm packages with their own
 * dependency trees, and a browser cannot resolve a bare `import "react"`, so
 * something has to bundle. Typechecking is still `tsc --noEmit`, unchanged and
 * still authoritative — esbuild only bundles, it does not check types.
 *
 * Two things keep the cost of that off the front page:
 *
 *   1. **Code splitting.** `src/commitBody.tsx` is reached through a dynamic
 *      import, so React and KaTeX land in their own chunk that is fetched the
 *      first time someone expands a commit card. A visitor who never expands
 *      one never downloads them.
 *   2. **Vendored, not linked.** KaTeX's stylesheet and fonts are copied into
 *      css/vendor/katex/ at build time rather than pulled from a CDN, because
 *      DESIGN.md R29 keeps third-party runtime requests off the page. The
 *      stylesheet is injected by the lazy chunk, so it is not requested until
 *      a card is expanded either.
 *
 * Both outputs are gitignored and rebuilt by CI before the Pages artifact is
 * uploaded, exactly as js/ already was.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { glob } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outdir = resolve(root, "js");
const katexOut = resolve(root, "css", "vendor", "katex");
// A second, unbundled emit of every module, for the Node test suite. The
// browser gets the bundle in js/; tests import individual modules, which a
// bundle cannot provide — js/site.js is one minified file with no exports.
const modulesOut = resolve(root, "modules");

const watch = process.argv.includes("--watch");

/** KaTeX's CSS resolves its faces at `fonts/` next to itself, so keep that shape. */
function vendorKatex() {
  const katexDist = resolve(root, "node_modules", "katex", "dist");
  rmSync(katexOut, { recursive: true, force: true });
  mkdirSync(katexOut, { recursive: true });
  cpSync(resolve(katexDist, "katex.min.css"), resolve(katexOut, "katex.min.css"));
  cpSync(resolve(katexDist, "fonts"), resolve(katexOut, "fonts"), { recursive: true });
  console.log(`Vendored KaTeX into ${katexOut.replace(root, ".")}`);
}

const options = {
  entryPoints: [
    resolve(root, "src", "site.ts"),
    resolve(root, "src", "contact.ts"),
  ],
  outdir,
  bundle: true,
  format: "esm",
  // Splitting is what puts React and KaTeX in a chunk of their own rather than
  // in the entry every page loads.
  splitting: true,
  target: ["es2022"],
  platform: "browser",
  minify: true,
  sourcemap: true,
  // react-markdown and its unified/remark dependencies branch on this; without
  // it the bundle keeps the development warnings and their cost.
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  logLevel: "info",
  metafile: true,
};

mkdirSync(outdir, { recursive: true });
vendorKatex();

/**
 * Transpile each source file on its own, preserving the tree.
 *
 * Not a bundle: imports stay as relative `./x.js` specifiers that Node can
 * resolve, so `tests/*.test.mjs` can import a single module and exercise it
 * directly. Dependencies from node_modules are left as bare specifiers, which
 * Node resolves itself.
 */
async function buildModules() {
  const entryPoints = [];
  for await (const file of glob("src/**/*.{ts,tsx}", { cwd: root })) {
    entryPoints.push(resolve(root, file));
  }
  await build({
    entryPoints,
    outdir: modulesOut,
    outbase: resolve(root, "src"),
    bundle: false,
    format: "esm",
    target: ["es2022"],
    platform: "neutral",
    sourcemap: false,
    logLevel: "warning",
  });
  console.log(`Emitted ${entryPoints.length} modules to ${modulesOut.replace(root, ".")} (tests)`);
}

if (watch) {
  const context = await (await import("esbuild")).context(options);
  await context.watch();
  console.log("Watching src/ …");
} else {
  await buildModules();
  const result = await build(options);
  const outputs = Object.entries(result.metafile.outputs)
    .filter(([file]) => file.endsWith(".js"))
    .sort((left, right) => right[1].bytes - left[1].bytes);
  for (const [file, meta] of outputs) {
    console.log(`  ${(meta.bytes / 1024).toFixed(1).padStart(8)} KB  ${file}`);
  }
}
