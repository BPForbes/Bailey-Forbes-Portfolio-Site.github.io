const LANGUAGE_COLORS = {
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
  Zig: "#ec915c"
};
const FALLBACK_COLORS = [
  "#8a8f98",
  "#9a7f6d",
  "#6f8a9a",
  "#8a6f8f",
  "#7f8a6f",
  "#9a8f6f",
  "#6f9a8a",
  "#8f7f9a"
];
function hashName(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function languageColor(name) {
  const known = LANGUAGE_COLORS[name];
  if (known !== void 0) {
    return known;
  }
  const index = hashName(name) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index] ?? "#8a8f98";
}
function hasCuratedColor(name) {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_COLORS, name);
}
export {
  hasCuratedColor,
  languageColor
};
