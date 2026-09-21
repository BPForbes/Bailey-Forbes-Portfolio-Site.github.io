import type { LanguageShare } from "./types.js";

/**
 * The project page's language visualisation — a donut, on its own, no bar
 * beside it.
 *
 * A stacked bar is this project's own dataviz reference's default answer
 * for part-to-whole; a donut is the form it deprioritises, sanctioned only
 * for a quick read at a handful of segments. Asked for directly as the
 * primary visualisation rather than a companion to the bar — a repository
 * with a dozen Linguist-reported languages does not stay "a quick read" at
 * a glance, which is why {@link foldLanguages} caps what actually reaches
 * the chart at five named segments plus one "Other" rather than rendering
 * every language Linguist ever saw.
 */

export interface DonutSegment {
  readonly name: string;
  readonly pct: number;
  readonly color: string;
  /** SVG `stroke-dasharray`, in the same units as the circle's radius. */
  readonly dasharray: string;
  /** SVG `stroke-dashoffset`, negative so segments run clockwise from 12 o'clock. */
  readonly dashoffset: number;
}

const VIEW_SIZE = 96;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 36;
const STROKE_WIDTH = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The surface-coloured sliver between segments — this site's stand-in for
 * the dataviz playbook's "2px surface gap" spacer, which assumes rectangular
 * marks. Capped per segment so a language under about 3% never loses its
 * whole arc to its own gap.
 */
const GAP = 2;

/** Individually-named segments before the tail folds into "Other". */
const MAX_NAMED = 5;

/**
 * A repository reporting more languages than a chart can name individually
 * still needs to add to 100% — the tail folds into one "Other" segment
 * rather than being dropped. This site's own neutral text-subtle grey
 * (`--p-ash` in the raw palette), not a language colour, so "Other" never
 * reads as a specific language it isn't.
 */
const OTHER_COLOR = "#8f897b";

/**
 * @returns `langs` unchanged if there are {@link MAX_NAMED} or fewer beyond
 * what the chart shows individually; otherwise the largest {@link MAX_NAMED}
 * shares by percentage, plus one trailing "Other" share summing the rest.
 * Pure and DOM-free — see tests/languagechart.test.mjs.
 */
export function foldLanguages(langs: readonly LanguageShare[]): readonly LanguageShare[] {
  // Folding two tiny languages into "Other" to save naming one of them is not
  // worth it — only fold when the tail is genuinely long.
  if (langs.length <= MAX_NAMED + 2) {
    return langs;
  }

  const sorted = [...langs].sort((a, b) => b.pct - a.pct);
  const named = sorted.slice(0, MAX_NAMED);
  const tail = sorted.slice(MAX_NAMED);
  const otherPct = tail.reduce((sum, lang) => sum + lang.pct, 0);

  return [...named, { name: "Other", pct: otherPct, color: OTHER_COLOR }];
}

/**
 * @returns One entry per language, in the order given, each carrying the
 * `stroke-dasharray`/`stroke-dashoffset` pair that draws its arc on a circle
 * of circumference {@link CIRCUMFERENCE}. Pure and DOM-free so it can be
 * tested without a browser (see tests/languagechart.test.mjs). Does not fold
 * — callers that want the "Other" tail apply {@link foldLanguages} first.
 */
export function donutSegments(langs: readonly LanguageShare[]): readonly DonutSegment[] {
  let cursorPct = 0;
  return langs.map((lang) => {
    const rawLen = (lang.pct / 100) * CIRCUMFERENCE;
    const gap = Math.min(GAP, rawLen * 0.3);
    const segLen = Math.max(0, rawLen - gap);
    const offset = -((cursorPct / 100) * CIRCUMFERENCE);
    cursorPct += lang.pct;
    return {
      name: lang.name,
      pct: lang.pct,
      color: lang.color,
      dasharray: `${segLen} ${CIRCUMFERENCE - segLen}`,
      dashoffset: offset,
    };
  });
}

/**
 * One decimal, with a trailing ".0" trimmed — matches the bar/legend
 * formatting this replaces (see the former lang-bar renderer in site.ts).
 */
function formatPct(pct: number): string {
  return pct.toFixed(1).replace(/\.0$/, "");
}

/**
 * Renders the donut and its legend into `mount`, which should be empty.
 * This is now the whole language visualisation — there is no bar beside it
 * — so the SVG itself carries the accessible name (`role="img"`); nothing
 * else on the page states these figures for it to defer to.
 */
export function renderLanguageChart(mount: HTMLElement, langs: readonly LanguageShare[]): void {
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
    `Language split: ${folded.map((lang) => `${lang.name} ${formatPct(lang.pct)} percent`).join(", ")}`,
  );

  // A single segment still needs to show as a full ring, not vanish under
  // its own end-gap — donutSegments() already caps the gap at 30% of the
  // segment's own length, so one 100% language draws a near-complete circle.
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
    // Rotate the whole ring so 0% starts at 12 o'clock instead of 3 o'clock,
    // matching how a clock — and every other pie chart — reads.
    circle.setAttribute("transform", `rotate(-90 ${CENTER} ${CENTER})`);
    svg.appendChild(circle);
  }

  const legend = document.createElement("div");
  legend.className = "lang-legend";
  legend.setAttribute("aria-hidden", "true"); // the chart's own aria-label already states these figures.

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
