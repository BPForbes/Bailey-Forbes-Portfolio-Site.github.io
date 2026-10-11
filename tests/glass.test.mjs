/**
 * The glass treatment's fallbacks, checked in the stylesheet itself.
 *
 * Glass is only acceptable because it can be switched off: both high-contrast
 * cuts, an OS request for reduced transparency, and a browser that cannot blur
 * all have to give plain opaque surfaces. These checks read css/styles.css as
 * text, so they catch a fallback being dropped without needing a browser.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");

/** The text of the first rule block that starts with `opener`. */
function block(opener) {
  const start = css.indexOf(opener);
  assert.ok(start >= 0, `missing: ${opener}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated: ${opener}`);
}

const OPAQUE_TOKENS = [
  ["--glass-blur", "0px"],
  ["--glass-gloss", "none"],
  ["--glow-a", "transparent"],
  ["--glow-b", "transparent"],
  ["--glass-fill", "transparent"],
  ["--glass-shadow", "none"],
];

for (const [name, opener] of [
  ["the explicit high-contrast cut", ':root[data-contrast="high"] {'],
  ["the OS high-contrast preference", "@media (prefers-contrast: more) {"],
  ["the OS reduced-transparency preference", "@media (prefers-reduced-transparency: reduce) {"],
]) {
  test(`${name} collapses glass to an opaque surface`, () => {
    const text = block(opener);
    for (const [token, value] of OPAQUE_TOKENS) {
      if (name.includes("transparency") && token === "--glass-shadow") continue; // shadow is not transparency
      assert.match(text, new RegExp(`${token}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`), `${token} must be ${value}`);
    }
  });
}

test("glass tints are opaque until the browser proves it can blur", () => {
  assert.match(css, /--glass-bg:\s*var\(--glass-opaque\)/, "default must be the opaque surface");
  const supported = block("@supports ((backdrop-filter: blur(1px))");
  assert.match(supported, /--glass-bg:\s*var\(--glass-tint\)/);
  assert.match(supported, /--glass-bg-bar:\s*var\(--glass-tint-bar\)/);
  assert.match(supported, /--glass-bg-sheet:\s*var\(--glass-tint-sheet\)/);
});

test("every backdrop-filter in the stylesheet is driven by the blur token", () => {
  // Declarations only: a line that starts with the property, so the
  // @supports feature test that mentions it is not counted as a use.
  const uses = [...css.matchAll(/^\s+(?:-webkit-)?backdrop-filter:\s*([^;]+);/gm)].map((m) => m[1].trim());
  assert.ok(uses.length > 0, "no backdrop-filter found");
  for (const value of uses) {
    assert.match(value, /var\(--glass-blur\)/, `a hard-coded blur would ignore the fallbacks: ${value}`);
  }
});

test("sheets close and open with transitions that the reduced-motion rule can zero", () => {
  const sheet = block(".sheet {");
  assert.match(sheet, /transition:/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{[\s\S]*?animation-duration: 0\.01ms !important/, "the sitewide reduced-motion rule must exist");
});

test("the first-paint pre-hide fails open and never applies under reduced motion", () => {
  assert.match(css, /@keyframes reveal-fail-open/);
  const gated = block("@media (prefers-reduced-motion: no-preference) {\n  html.js:not(.reveal-ready)");
  assert.match(gated, /animation:\s*reveal-fail-open 0s 2\.5s forwards/);
  assert.match(gated, /:not\(\[data-motion="reduced"\]\)/);
});
