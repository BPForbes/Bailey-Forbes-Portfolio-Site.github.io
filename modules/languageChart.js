const VIEW_SIZE = 64;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 24;
const STROKE_WIDTH = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 1.6;
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
function renderLanguageChart(mount, langs) {
  if (langs.length === 0) {
    return;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
  svg.setAttribute("class", "lang-chart");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const seg of donutSegments(langs)) {
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
  mount.appendChild(svg);
}
export {
  donutSegments,
  renderLanguageChart
};
