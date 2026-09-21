const VIEW_SIZE = 96;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 36;
const STROKE_WIDTH = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;
const MAX_NAMED = 5;
const OTHER_COLOR = "#8f897b";
function foldLanguages(langs) {
  if (langs.length <= MAX_NAMED + 2) {
    return langs;
  }
  const sorted = [...langs].sort((a, b) => b.pct - a.pct);
  const named = sorted.slice(0, MAX_NAMED);
  const tail = sorted.slice(MAX_NAMED);
  const otherPct = tail.reduce((sum, lang) => sum + lang.pct, 0);
  return [...named, { name: "Other", pct: otherPct, color: OTHER_COLOR }];
}
function donutSegments(langs) {
  let cursorPct = 0;
  return langs.map((lang) => {
    const rawLen = lang.pct / 100 * CIRCUMFERENCE;
    const gap = Math.min(GAP, rawLen * 0.3);
    const segLen = Math.max(0, rawLen - gap);
    const offset = -(cursorPct / 100 * CIRCUMFERENCE);
    cursorPct += lang.pct;
    return {
      name: lang.name,
      pct: lang.pct,
      color: lang.color,
      dasharray: `${segLen} ${CIRCUMFERENCE - segLen}`,
      dashoffset: offset
    };
  });
}
function formatPct(pct) {
  return pct.toFixed(1).replace(/\.0$/, "");
}
function renderLanguageChart(mount, langs) {
  if (langs.length === 0) {
    return;
  }
  const folded = foldLanguages(langs);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
  svg.setAttribute("class", "lang-chart");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Language split: ${folded.map((lang) => `${lang.name} ${formatPct(lang.pct)} percent`).join(", ")}`
  );
  for (const seg of donutSegments(folded)) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(CENTER));
    circle.setAttribute("cy", String(CENTER));
    circle.setAttribute("r", String(RADIUS));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", seg.color);
    circle.setAttribute("stroke-width", String(STROKE_WIDTH));
    circle.setAttribute("stroke-dasharray", seg.dasharray);
    circle.setAttribute("stroke-dashoffset", String(seg.dashoffset));
    circle.setAttribute("transform", `rotate(-90 ${CENTER} ${CENTER})`);
    svg.appendChild(circle);
  }
  const legend = document.createElement("div");
  legend.className = "lang-legend";
  legend.setAttribute("aria-hidden", "true");
  for (const lang of folded) {
    const item = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.className = "lang-swatch";
    swatch.style.background = lang.color;
    item.append(swatch, document.createTextNode(`${lang.name} ${formatPct(lang.pct)}%`));
    legend.appendChild(item);
  }
  const figure = document.createElement("div");
  figure.className = "lang-chart-figure";
  figure.append(svg, legend);
  mount.appendChild(figure);
}
export {
  donutSegments,
  foldLanguages,
  renderLanguageChart
};
