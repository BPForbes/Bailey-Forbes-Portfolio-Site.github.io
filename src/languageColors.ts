/**
 * Colours for the language bars.
 *
 * These are a design decision, not something GitHub reports, which is why they
 * live here and not in `data/projects.generated.json` — the generated file
 * carries only what the API actually said (DESIGN.md R21).
 *
 * The first block is the palette this site already used for the languages it
 * already showed, kept byte-for-byte so the bars look the way they always have.
 * Below it are GitHub's own Linguist colours for languages a repository might
 * pick up next, muted where the raw value fights the page. Anything still
 * unknown gets a stable colour derived from its name, so a new language is
 * never invisible and never changes colour between builds.
 */

/** Exactly the values `data.ts` shipped, so existing bars are unchanged. */
const SITE_PALETTE: Readonly<Record<string, string>> = {
  Kotlin: "#A97BFF",
  Java: "#b07219",
  "Firebase / REST": "#FFA000",
  "C#": "#512bd4",
  TypeScript: "#3178c6",
  CSS: "#c98a4a",
  PowerShell: "#5391FE",
  Shell: "#7ea36a",
  C: "#555555",
  Assembly: "#c98a4a",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  "C++": "#f34b7d",
  Rust: "#dea584",
  SQL: "#e38c00",
  HTML: "#e34c26",
};

/** Linguist colours for languages these repositories can plausibly gain. */
const LINGUIST_PALETTE: Readonly<Record<string, string>> = {
  Makefile: "#427819",
  CMake: "#DA3434",
  Dockerfile: "#384d54",
  Nix: "#7e7eff",
  "Linker Script": "#7a7a7a",
  Go: "#00ADD8",
  Ruby: "#701516",
  Swift: "#F05138",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  SCSS: "#c6538c",
  Less: "#1d365d",
  Lua: "#000080",
  Perl: "#0298c3",
  Haskell: "#5e5086",
  Zig: "#ec915c",
  Objective: "#438eff",
  "Objective-C": "#438eff",
  Batchfile: "#C1F12E",
  TeX: "#3D6117",
  Roff: "#ecdebe",
  Yacc: "#4B6C4B",
  Lex: "#DBCA00",
  Awk: "#c30e9b",
  Sed: "#64b970",
  Gherkin: "#5B2063",
  HCL: "#844FBA",
  Jinja: "#a52a22",
  Smarty: "#f0c040",
  EJS: "#a91e50",
  Handlebars: "#f7931e",
  Mustache: "#724b3b",
  Blade: "#f7523f",
  Astro: "#ff5a03",
};

/** The fold-in bucket `metadata.ts` adds when it trims a long tail. */
const OTHER = "#8c8c8c";

/**
 * A stable colour for a language nothing above names.
 *
 * Derived from the name so it never moves between builds, and constrained to
 * the saturation and lightness the rest of the bars sit at, so an unexpected
 * language cannot arrive as a stripe brighter than everything beside it.
 */
function derivedColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360} 42% 52%)`;
}

export function languageColor(name: string): string {
  if (name === "Other") {
    return OTHER;
  }
  return SITE_PALETTE[name] ?? LINGUIST_PALETTE[name] ?? derivedColor(name);
}
