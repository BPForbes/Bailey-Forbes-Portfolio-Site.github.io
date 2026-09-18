/**
 * The single language -> colour table for the whole site.
 *
 * Colours live here rather than in generated data for two reasons: the
 * generated file is rewritten by a robot and should carry facts rather than
 * design decisions, and a palette change should be one edit rather than a
 * resync of every project.
 *
 * These are the portfolio's own colours, carried over verbatim from the
 * hand-written table that used to sit in src/data.ts — deliberately not
 * GitHub's Linguist palette, which clashes with this page's surfaces.
 */

/** Known languages, keyed exactly as GitHub Linguist names them. */
const LANGUAGE_COLORS: Readonly<Record<string, string>> = {
  Assembly: "#c98a4a",
  C: "#555555",
  "C#": "#512bd4",
  "C++": "#f34b7d",
  CSS: "#c98a4a",
  "Firebase / REST": "#FFA000",
  Go: "#00ADD8",
  HTML: "#e34c26",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  Kotlin: "#A97BFF",
  Lua: "#000080",
  Makefile: "#427819",
  Nix: "#7e7eff",
  "Objective-C": "#438eff",
  PHP: "#4F5D95",
  PowerShell: "#5391FE",
  Python: "#3572A5",
  Ruby: "#701516",
  Rust: "#dea584",
  SQL: "#e38c00",
  Shell: "#7ea36a",
  Svelte: "#ff3e00",
  Swift: "#F05138",
  TypeScript: "#3178c6",
  Vue: "#41b883",
  Zig: "#ec915c",
};

/**
 * Hues reserved for languages the table has never heard of.
 *
 * Chosen to sit in the same muted register as the curated colours, so an
 * unexpected language looks deliberate rather than broken. A new language must
 * never fail the build or render as a blank segment — it just gets one of these
 * until someone adds a real colour above.
 */
const FALLBACK_COLORS: readonly string[] = [
  "#8a8f98",
  "#9a7f6d",
  "#6f8a9a",
  "#8a6f8f",
  "#7f8a6f",
  "#9a8f6f",
  "#6f9a8a",
  "#8f7f9a",
];

/**
 * Stable string hash (FNV-1a, 32-bit).
 *
 * Determinism is the point: the same language gets the same fallback colour on
 * every page and every build, so the bar and its legend always agree and a
 * rebuild never reshuffles the palette.
 */
function hashName(name: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Resolve a display colour for a language name.
 *
 * Always returns a colour — there is no failure mode here by design.
 */
export function languageColor(name: string): string {
  const known = LANGUAGE_COLORS[name];
  if (known !== undefined) {
    return known;
  }
  const index = hashName(name) % FALLBACK_COLORS.length;
  // noUncheckedIndexedAccess: the modulo keeps this in range, but prove it.
  return FALLBACK_COLORS[index] ?? "#8a8f98";
}

/** Whether a language has a curated colour, used only by tests and tooling. */
export function hasCuratedColor(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_COLORS, name);
}
