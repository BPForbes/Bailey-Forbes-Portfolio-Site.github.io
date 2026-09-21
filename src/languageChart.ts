import type { LanguageShare } from "./types.js";

/**
 * A compact "at a glance" companion to `.lang-bar`, not a replacement for it.
 *
 * The dataviz playbook this site follows is explicit that part-to-whole
 * belongs on a stacked bar — a donut is the deprioritized form, sanctioned
 * only for a quick read at six segments or fewer. `.lang-bar` stays the
 * precise, primary visualisation; this renders beside it as the same data in
 * a different, more glanceable shape. Both read one shared legend (built by
 * the caller in site.ts) rather than each carrying a separate one, since a
 * second legend for the same data would just repeat the first.
 *
 * The chart is `aria-hidden`: `.lang-bar` already carries the accessible
 * name for this data (`role="img"` with the full "Language split: …"
 * label), so a second announcement of the same figures would be noise, not
 * information — the same reasoning icons.ts already applies to every glyph
 * that sits beside text saying what it means.
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

const VIEW_SIZE = 64;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 24;
const STROKE_WIDTH = 11;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The surface-coloured sliver between segments — this site's stand-in for
 * the dataviz playbook's "2px surface gap" spacer, which assumes rectangular
 * marks. Capped per segment so a language under about 3% never loses its
 * whole arc to its own gap.
 */
const GAP = 1.6;

/**
 * @returns One entry per language, in the order given, each carrying the
 * `stroke-dasharray`/`stroke-dashoffset` pair that draws its arc on a circle
 * of circumference {@link CIRCUMFERENCE}. Pure and DOM-free so it can be
 * tested without a browser (see tests/languagechart.test.mjs).
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
 * Renders the donut into `mount`. `mount` should be empty; this appends
 * rather than replacing, so it composes with `.lang-bar` in the same
 * container without either mount function needing to know about the other.
 */
export function renderLanguageChart(mount: HTMLElement, langs: readonly LanguageShare[]): void {
  if (langs.length === 0) {
    return;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
  svg.setAttribute("class", "lang-chart");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  // A single segment still needs to show as a full ring, not vanish under
  // its own end-gap — donutSegments() already caps the gap at 30% of the
  // segment's own length, so one 100% language draws a near-complete circle.
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
    // Rotate the whole ring so 0% starts at 12 o'clock instead of 3 o'clock,
    // matching how a clock — and every other pie chart — reads.
    circle.setAttribute("transform", `rotate(-90 ${CENTER} ${CENTER})`);
    svg.appendChild(circle);
  }

  mount.appendChild(svg);
}
